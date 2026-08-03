/**
 * Portlander — refresh-quotes Edge Function
 *
 * User-triggered live price refresh plus one position-level performance
 * snapshot per market date. Unlike sync-events (global,
 * unscoped — writes shared events rows safe for any authenticated caller),
 * this function does privileged per-user writes to holdings.last_price, so
 * every read/write is explicitly scoped to the calling user, resolved from
 * their JWT. It never iterates other users' holdings.
 *
 * Secrets (supabase secrets set):
 *   FINNHUB_API_KEY
 *   SUPABASE_URL               (auto-injected on hosted Edge)
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-injected on hosted Edge)
 *
 * Invoke manually via the SPA, which attaches the user's session token. A
 * single-owner deployment may also invoke it from pg_cron using the anon key
 * plus x-performance-cron-secret. Scheduled ownership is pinned either by
 * PERFORMANCE_OWNER_USER_ID/PERFORMANCE_CRON_SECRET or by the service-only
 * performance_cron_config row; neither path accepts a caller-supplied user id.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

type FinnhubQuote = {
  c?: number | null // current price
  d?: number | null
  dp?: number | null
  h?: number | null
  l?: number | null
  o?: number | null
  pc?: number | null
  t?: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-performance-cron-secret',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!finnhubKey || !supabaseUrl || !anonKey || !serviceKey) {
    return json(
      {
        error: 'Missing secrets',
        need: ['FINNHUB_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
      500,
    )
  }

  // Privileged client for the actual work — every query below is explicitly
  // scoped to userId. Unlike sync-events, this never iterates all users.
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const cronSecret = Deno.env.get('PERFORMANCE_CRON_SECRET')?.trim()
  const suppliedCronSecret = req.headers.get('x-performance-cron-secret')?.trim()
  const ownerUserId = Deno.env.get('PERFORMANCE_OWNER_USER_ID')?.trim()
  const envScheduledOwner =
    cronSecret && suppliedCronSecret && ownerUserId && safeEqual(cronSecret, suppliedCronSecret)
      ? ownerUserId
      : null
  const scheduledOwner =
    envScheduledOwner ?? (await scheduledOwnerFromDatabase(sb, suppliedCronSecret))
  const scheduled = Boolean(scheduledOwner)

  let userId: string
  if (scheduledOwner) {
    userId = scheduledOwner
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    // Resolve the CALLING user's identity from their own JWT. verify_jwt:true
    // already validated the token at the gateway; this recovers the identity
    // in a supported way rather than hand-decoding it.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    userId = userData.user.id
  }

  const { data: holdingRows, error: hErr } = await sb
    .from('holdings')
    .select('ticker, shares, tags')
    .eq('user_id', userId)

  if (hErr) {
    return json({ error: `Failed to load holdings: ${hErr.message}` }, 500)
  }

  const tickers = [...new Set((holdingRows ?? []).map((r) => String(r.ticker).toUpperCase()))].sort()
  const holdingsByTicker = new Map(
    (holdingRows ?? []).map((row) => [String(row.ticker).toUpperCase(), row]),
  )

  const startedAt = new Date().toISOString()
  const { data: runRow, error: runInsertErr } = await sb
    .from('sync_runs')
    .insert({
      started_at: startedAt,
      status: 'running',
      provider: 'finnhub-quotes',
    })
    .select('id')
    .single()

  if (runInsertErr) {
    return json({ error: 'Failed to create sync_runs row', detail: runInsertErr.message }, 500)
  }

  const runId = runRow.id as string

  if (tickers.length === 0) {
    await finishRun(sb, runId, {
      status: 'ok',
      tickers_count: 0,
      events_upserted: 0,
      error: 'No holdings',
    })
    return json({ ok: true, status: 'ok', tickers: 0, results: [], errors: [], runId, finishedAt: new Date().toISOString() })
  }

  const results: { ticker: string; lastPrice: number; dayChangeValue: number | null; dayChangePct: number | null }[] = []
  const snapshotCandidates: SnapshotCandidate[] = []
  const errors: string[] = []

  for (const ticker of tickers) {
    try {
      const quote = await fetchQuote(ticker, finnhubKey)
      if (quote.c == null || quote.c === 0) {
        errors.push(`${ticker}: no price data`)
      } else {
        const { data: updated, error: updErr } = await sb
          .from('holdings')
          .update({
            last_price: quote.c,
            day_change_value: quote.d ?? null,
            day_change_pct: quote.dp ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('ticker', ticker)
          .select('ticker')
        if (updErr) {
          errors.push(`${ticker}: ${updErr.message}`)
        } else if (updated && updated.length > 0) {
          results.push({
            ticker,
            lastPrice: quote.c,
            dayChangeValue: quote.d ?? null,
            dayChangePct: quote.dp ?? null,
          })
          const holding = holdingsByTicker.get(ticker)
          const shares = Number(holding?.shares)
          if (
            Number.isFinite(shares) &&
            shares > 0 &&
            quote.pc != null &&
            quote.pc > 0 &&
            quote.d != null &&
            Number.isFinite(quote.d) &&
            quote.t != null &&
            Number.isFinite(quote.t)
          ) {
            snapshotCandidates.push({
              snapshotDate: marketDateFromEpoch(quote.t),
              ticker,
              shares,
              price: quote.c,
              previousClose: quote.pc,
              marketValue: shares * quote.c,
              dayChangeValue: quote.d,
              dayChangePct: quote.dp ?? null,
              tags: Array.isArray(holding?.tags) ? holding.tags.map(String) : [],
              quoteTimestamp: new Date(quote.t * 1000).toISOString(),
            })
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${ticker}: ${msg}`)
    }
    await sleep(200)
  }

  const status = errors.length ? (results.length ? 'partial' : 'error') : 'ok'
  const finishedAt = new Date().toISOString()
  let snapshot: Record<string, unknown>
  try {
    snapshot = await persistBestSnapshot(
      sb,
      userId,
      tickers,
      snapshotCandidates,
      finishedAt,
    )
  } catch (error) {
    // Price refresh remains useful if snapshot storage is temporarily
    // unavailable (for example during a rolling schema/function deploy).
    snapshot = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
  await finishRun(sb, runId, {
    status,
    tickers_count: tickers.length,
    events_upserted: results.length,
    error: errors.length ? errors.slice(0, 20).join(' | ') : null,
  })

  return json({
    ok: status !== 'error',
    status,
    tickers: tickers.length,
    results,
    errors: errors.slice(0, 20),
    runId,
    finishedAt,
    snapshot,
    scheduled,
  })
})

type SnapshotCandidate = {
  snapshotDate: string
  ticker: string
  shares: number
  price: number
  previousClose: number
  marketValue: number
  dayChangeValue: number
  dayChangePct: number | null
  tags: string[]
  quoteTimestamp: string
}

async function persistBestSnapshot(
  sb: ReturnType<typeof createClient>,
  userId: string,
  tickers: string[],
  candidates: SnapshotCandidate[],
  capturedAt: string,
) {
  if (tickers.length === 0 || candidates.length === 0) {
    return { status: 'unavailable', capturedPositions: 0, expectedPositions: tickers.length }
  }

  // Finnhub's quote timestamp names the market session. On weekends or before
  // open it remains Friday/the prior session, so no fake Saturday snapshot is
  // created. Keep only the dominant session if a provider returns mixed dates.
  const counts = new Map<string, number>()
  for (const row of candidates) counts.set(row.snapshotDate, (counts.get(row.snapshotDate) ?? 0) + 1)
  const snapshotDate = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const rows = candidates.filter((row) => row.snapshotDate === snapshotDate)
  const captured = new Set(rows.map((row) => row.ticker))
  const missingTickers = tickers.filter((ticker) => !captured.has(ticker))
  const snapshotStatus = missingTickers.length === 0 ? 'ok' : rows.length ? 'partial' : 'error'

  const { data: existing } = await sb
    .from('portfolio_snapshot_runs')
    .select('id, status, captured_positions')
    .eq('user_id', userId)
    .eq('snapshot_date', snapshotDate)
    .maybeSingle()

  // A later partial refresh must not destroy a complete snapshot already
  // captured for that market session.
  if (existing?.status === 'ok' && snapshotStatus !== 'ok') {
    return {
      snapshotDate,
      status: 'ok',
      capturedPositions: existing.captured_positions,
      expectedPositions: tickers.length,
      preservedEarlierCompleteSnapshot: true,
    }
  }

  const { data: run, error: runError } = await sb
    .from('portfolio_snapshot_runs')
    .upsert(
      {
        user_id: userId,
        snapshot_date: snapshotDate,
        status: snapshotStatus,
        expected_positions: tickers.length,
        captured_positions: rows.length,
        missing_tickers: missingTickers,
        captured_at: capturedAt,
      },
      { onConflict: 'user_id,snapshot_date' },
    )
    .select('id')
    .single()
  if (runError || !run) throw new Error(`Snapshot run write failed: ${runError?.message ?? 'no row'}`)

  const { error: deleteError } = await sb
    .from('portfolio_snapshots')
    .delete()
    .eq('user_id', userId)
    .eq('snapshot_date', snapshotDate)
  if (deleteError) throw new Error(`Snapshot replacement failed: ${deleteError.message}`)

  if (rows.length > 0) {
    const { error: insertError } = await sb.from('portfolio_snapshots').insert(
      rows.map((row) => ({
        snapshot_run_id: run.id,
        user_id: userId,
        snapshot_date: snapshotDate,
        ticker: row.ticker,
        shares: row.shares,
        price: row.price,
        previous_close: row.previousClose,
        market_value: row.marketValue,
        day_change_value: row.dayChangeValue,
        day_change_pct: row.dayChangePct,
        tags: row.tags,
        quote_timestamp: row.quoteTimestamp,
        captured_at: capturedAt,
      })),
    )
    if (insertError) throw new Error(`Snapshot rows write failed: ${insertError.message}`)
  }

  return {
    snapshotDate,
    status: snapshotStatus,
    capturedPositions: rows.length,
    expectedPositions: tickers.length,
    missingTickers,
  }
}

async function fetchQuote(symbol: string, token: string): Promise<FinnhubQuote> {
  const url = new URL(`${FINNHUB_BASE}/quote`)
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Finnhub ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as FinnhubQuote
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function marketDateFromEpoch(epochSeconds: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochSeconds * 1000))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function scheduledOwnerFromDatabase(
  sb: ReturnType<typeof createClient>,
  suppliedSecret: string | undefined,
): Promise<string | null> {
  if (!suppliedSecret) return null

  const { data, error } = await sb
    .from('performance_cron_config')
    .select('owner_user_id, secret_hash')
    .eq('singleton', true)
    .maybeSingle()
  if (error || !data?.owner_user_id || typeof data.secret_hash !== 'string') return null

  const suppliedHash = await sha256Hex(suppliedSecret)
  return safeEqual(data.secret_hash, suppliedHash) ? String(data.owner_user_id) : null
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function safeEqual(expected: string, supplied: string): boolean {
  if (expected.length !== supplied.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index)
  }
  return mismatch === 0
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
