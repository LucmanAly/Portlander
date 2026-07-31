/**
 * Portlander — refresh-quotes Edge Function
 *
 * Manual, user-triggered live price refresh. Unlike sync-events (global,
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
 * Invoke: only via the SPA (supabase.functions.invoke('refresh-quotes')),
 * which attaches the signed-in user's session token automatically.
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
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  // Resolve the CALLING user's identity from their own JWT. verify_jwt:true
  // already validated the token at the gateway; this recovers the identity
  // in a supported way rather than hand-decoding it.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const userId = userData.user.id

  // Privileged client for the actual work — every query below is explicitly
  // scoped to userId. Unlike sync-events, this never iterates all users.
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: holdingRows, error: hErr } = await sb
    .from('holdings')
    .select('ticker')
    .eq('user_id', userId)

  if (hErr) {
    return json({ error: `Failed to load holdings: ${hErr.message}` }, 500)
  }

  const tickers = [...new Set((holdingRows ?? []).map((r) => String(r.ticker).toUpperCase()))].sort()

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
  })
})

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
