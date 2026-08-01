/**
 * Portlander — sync-events Edge Function
 *
 * Fetches Finnhub earnings calendar for all holdings ∪ watchlist tickers,
 * upserts into public.events (global rows, user_id null), logs public.sync_runs.
 * Also refreshes the macro rows (FOMC/CPI/NFP) from the static, hand-verified
 * table in ../_shared/macro-calendar.ts — see that file for sourcing.
 *
 * Secrets (supabase secrets set):
 *   FINNHUB_API_KEY
 *   SUPABASE_URL          (auto-injected on hosted Edge as SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Invoke:
 *   supabase functions deploy sync-events
 *   curl -X POST "$SUPABASE_URL/functions/v1/sync-events" \
 *     -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE_KEY"
 *
 * Cron: Supabase Dashboard → Edge Functions → Schedules → daily 06:00 UTC
 *
 * Cloud auth for the SPA is optional/deferred — this function uses service role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { MACRO_CALENDAR } from '../_shared/macro-calendar.ts'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const LOOKAHEAD_DAYS = 90
const LOOKBACK_DAYS = 7

type FinnhubEarning = {
  date: string
  symbol: string
  hour?: string
  epsEstimate?: number | null
  epsActual?: number | null
  revenueEstimate?: number | null
  revenueActual?: number | null
  quarter?: number
  year?: number
}

type Timing = 'bmo' | 'amc' | 'unknown'

Deno.serve(async (req) => {
  // Allow CORS for manual dashboard / curl testing
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!finnhubKey || !supabaseUrl || !serviceKey) {
    return json(
      {
        error: 'Missing secrets',
        need: ['FINNHUB_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
      500,
    )
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = new Date().toISOString()
  const { data: runRow, error: runInsertErr } = await sb
    .from('sync_runs')
    .insert({
      started_at: startedAt,
      status: 'running',
      provider: 'finnhub',
    })
    .select('id')
    .single()

  if (runInsertErr) {
    return json({ error: 'Failed to create sync_runs row', detail: runInsertErr.message }, 500)
  }

  const runId = runRow.id as string

  try {
    const tickers = await loadTickers(sb)
    if (tickers.length === 0) {
      await finishRun(sb, runId, {
        status: 'ok',
        tickers_count: 0,
        events_upserted: 0,
        error: 'No tickers in holdings/watchlist',
      })
      return json({ ok: true, tickers: 0, upserted: 0, note: 'No tickers' })
    }

    const { from, to } = dateWindow()
    let upserted = 0
    const errors: string[] = []

    // Per-symbol to stay within free-tier filters; small portfolios only.
    for (const symbol of tickers) {
      try {
        const rows = await fetchEarnings(symbol, from, to, finnhubKey)
        for (const row of rows) {
          const event = toEventRow(row)
          const { error } = await sb.from('events').upsert(event, {
            onConflict: 'id',
          })
          if (error) {
            errors.push(`${symbol} ${row.date}: ${error.message}`)
          } else {
            upserted++
          }
        }
        // Gentle pacing for free tier (60/min)
        await sleep(200)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${symbol}: ${msg}`)
      }
    }

    // Seed/refresh shared macro rows (deterministic ids) from the published calendar.
    for (const entry of MACRO_CALENDAR) {
      const row = macroRow(entry)
      const { error } = await sb.from('events').upsert(row, { onConflict: 'id' })
      if (error) errors.push(`macro ${row.title} ${row.event_date}: ${error.message}`)
      else upserted++
    }

    const status = errors.length ? 'partial' : 'ok'
    await finishRun(sb, runId, {
      status,
      tickers_count: tickers.length,
      events_upserted: upserted,
      error: errors.length ? errors.slice(0, 20).join(' | ') : null,
    })

    return json({
      ok: errors.length === 0,
      status,
      tickers: tickers.length,
      upserted,
      from,
      to,
      errors: errors.slice(0, 20),
      runId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await finishRun(sb, runId, {
      status: 'error',
      tickers_count: 0,
      events_upserted: 0,
      error: msg,
    })
    return json({ error: msg, runId }, 500)
  }
})

async function loadTickers(sb: ReturnType<typeof createClient>): Promise<string[]> {
  const [h, w] = await Promise.all([
    sb.from('holdings').select('ticker'),
    sb.from('watchlist').select('ticker'),
  ])
  if (h.error) throw new Error(`holdings: ${h.error.message}`)
  if (w.error) throw new Error(`watchlist: ${w.error.message}`)

  const set = new Set<string>()
  for (const row of [...(h.data ?? []), ...(w.data ?? [])]) {
    const t = String(row.ticker ?? '')
      .trim()
      .toUpperCase()
    if (t) set.add(t)
  }
  return [...set].sort()
}

function dateWindow(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS)
  const to = new Date(now)
  to.setUTCDate(to.getUTCDate() + LOOKAHEAD_DAYS)
  return { from: ymd(from), to: ymd(to) }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchEarnings(
  symbol: string,
  from: string,
  to: string,
  token: string,
): Promise<FinnhubEarning[]> {
  const url = new URL(`${FINNHUB_BASE}/calendar/earnings`)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Finnhub ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { earningsCalendar?: FinnhubEarning[] }
  return (data.earningsCalendar ?? []).filter(
    (e) => e.symbol?.toUpperCase() === symbol.toUpperCase() && e.date,
  )
}

function mapHour(hour?: string): Timing {
  const h = (hour ?? '').toLowerCase()
  if (h === 'bmo') return 'bmo'
  if (h === 'amc') return 'amc'
  return 'unknown'
}

function toEventRow(row: FinnhubEarning) {
  const symbol = row.symbol.toUpperCase()
  const timing = mapHour(row.hour)
  const status =
    row.epsActual != null || row.revenueActual != null ? 'confirmed' : 'estimated'
  const id = deterministicUuid(`earnings|${symbol}|${row.date}`)

  return {
    id,
    user_id: null,
    ticker: symbol,
    title: `${symbol} earnings`,
    event_type: 'earnings',
    event_date: row.date,
    event_time: null,
    timing,
    status,
    source: 'finnhub',
    description: [
      row.quarter != null && row.year != null ? `Q${row.quarter} ${row.year}` : null,
      row.epsEstimate != null ? `EPS est ${row.epsEstimate}` : null,
      row.epsActual != null ? `EPS act ${row.epsActual}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    raw: row as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }
}

function macroRow(entry: (typeof MACRO_CALENDAR)[number]) {
  return {
    id: deterministicUuid(`macro|${entry.eventType}|${entry.eventDate}`),
    user_id: null,
    ticker: null,
    title: entry.title,
    event_type: entry.eventType,
    event_date: entry.eventDate,
    event_time: null,
    timing: entry.timing,
    status: entry.status,
    source: 'macro-calendar',
    description: entry.description,
    raw: null,
    updated_at: new Date().toISOString(),
  }
}

async function finishRun(
  sb: ReturnType<typeof createClient>,
  id: string,
  patch: {
    status: string
    tickers_count: number
    events_upserted: number
    error: string | null
  },
) {
  await sb
    .from('sync_runs')
    .update({
      ...patch,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/** Deterministic UUIDv5-like from SHA-256 (stable upserts). */
function deterministicUuid(key: string): string {
  const hash = fnvLikeHex(key)
  const bytes = hash.padEnd(32, '0').slice(0, 32).split('')
  // version 4-ish layout with fixed variant bits for valid UUID string
  bytes[12] = '4'
  const variantNibble = (parseInt(bytes[16], 16) & 0x3) | 0x8
  bytes[16] = variantNibble.toString(16)
  const h = bytes.join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/** Fast stable hex for Deno without subtle crypto await in sync path */
function fnvLikeHex(input: string): string {
  // Use Web Crypto if available synchronously via cached map — use simple DJB2-expand
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 0x811c9dc5) >>> 0
  }
  // Expand to 32 hex chars
  const parts: string[] = []
  let a = h1
  let b = h2
  for (let i = 0; i < 4; i++) {
    a = Math.imul(a ^ b, 0x85ebca6b) >>> 0
    b = Math.imul(b ^ a, 0xc2b2ae35) >>> 0
    parts.push(a.toString(16).padStart(8, '0'))
  }
  return parts.join('')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
