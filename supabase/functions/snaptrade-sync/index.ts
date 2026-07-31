/**
 * Portlander — snaptrade-sync Edge Function
 *
 * User-scoped (like refresh-quotes). Pulls the calling user's live brokerage
 * positions from SnapTrade and merges them into holdings — additive/merge,
 * never destructive: only tickers present in the sync get touched, manual/
 * CSV tickers the brokerage doesn't cover are left alone. Never writes
 * last_price/day_change_* — that stays refresh-quotes's (Finnhub) job.
 *
 * Known v1 gap: if a position is fully sold or a connection is removed on
 * SnapTrade's side, the corresponding holdings row is not deleted or zeroed
 * here — it just stops being refreshed by future syncs. Revisit if this
 * shows up in practice (would need a per-sync "seen tickers" diff+delete,
 * scoped to source='snaptrade' only, mirroring persistHoldingsRemote's
 * delete-then-upsert shape but source-scoped).
 *
 * Secrets (supabase secrets set):
 *   SNAPTRADE_CLIENT_ID
 *   SNAPTRADE_CONSUMER_KEY
 *   SUPABASE_URL               (auto-injected on hosted Edge)
 *   SUPABASE_ANON_KEY          (auto-injected on hosted Edge)
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-injected on hosted Edge)
 *
 * Invoke: only via the SPA (supabase.functions.invoke('snaptrade-sync')),
 * which attaches the signed-in user's session token automatically.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { Snaptrade, SnaptradeAuth } from 'npm:snaptrade-typescript-sdk@11'

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

  const clientId = Deno.env.get('SNAPTRADE_CLIENT_ID')
  const consumerKey = Deno.env.get('SNAPTRADE_CONSUMER_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!clientId || !consumerKey || !supabaseUrl || !anonKey || !serviceKey) {
    return json(
      {
        error: 'Missing secrets',
        need: [
          'SNAPTRADE_CLIENT_ID',
          'SNAPTRADE_CONSUMER_KEY',
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
        ],
      },
      500,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const userId = userData.user.id

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: stUser, error: stUserErr } = await sb
    .from('snaptrade_users')
    .select('snaptrade_user_id, user_secret')
    .eq('user_id', userId)
    .maybeSingle()
  if (stUserErr) {
    return json({ error: `Failed to load SnapTrade registration: ${stUserErr.message}` }, 500)
  }
  if (!stUser) {
    return json({ error: 'Not connected to SnapTrade yet — connect a brokerage first' }, 400)
  }

  const snaptradeUserId = stUser.snaptrade_user_id as string
  const userSecret = stUser.user_secret as string
  const snaptrade = new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
  })

  const startedAt = new Date().toISOString()
  const { data: runRow, error: runInsertErr } = await sb
    .from('sync_runs')
    .insert({ started_at: startedAt, status: 'running', provider: 'snaptrade-positions' })
    .select('id')
    .single()
  if (runInsertErr) {
    return json({ error: 'Failed to create sync_runs row', detail: runInsertErr.message }, 500)
  }
  const runId = runRow.id as string

  const errors: string[] = []

  try {
    // Refresh connection metadata for the "Connected: ..." UI.
    const authRes = await snaptrade.connections.listBrokerageAuthorizations({
      userId: snaptradeUserId,
      userSecret,
    })
    const authorizations = authRes.data ?? []
    for (const auth of authorizations) {
      const brokerageName =
        auth.brokerage?.display_name ?? auth.brokerage?.name ?? auth.name ?? 'Connected brokerage'
      const { error: connErr } = await sb.from('snaptrade_connections').upsert(
        {
          user_id: userId,
          brokerage_name: brokerageName,
          authorization_id: auth.id,
        },
        { onConflict: 'user_id,authorization_id' },
      )
      if (connErr) errors.push(`connection ${auth.id}: ${connErr.message}`)
    }

    const accountsRes = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret,
    })
    const accounts = accountsRes.data ?? []

    const aggregated = new Map<
      string,
      { ticker: string; name?: string; totalUnits: number; totalCost: number }
    >()

    for (const account of accounts) {
      try {
        const posRes = await snaptrade.accountInformation.getAllAccountPositions({
          accountId: account.id,
          userId: snaptradeUserId,
          userSecret,
        })
        for (const pos of posRes.data?.results ?? []) {
          const parsed = extractPosition(pos)
          if (!parsed) continue
          const entry = aggregated.get(parsed.ticker) ?? {
            ticker: parsed.ticker,
            name: parsed.name,
            totalUnits: 0,
            totalCost: 0,
          }
          entry.totalUnits += parsed.units
          entry.totalCost += parsed.units * parsed.avgPrice
          if (!entry.name && parsed.name) entry.name = parsed.name
          aggregated.set(parsed.ticker, entry)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`account ${account.id}: ${msg}`)
      }
    }

    const rows = [...aggregated.values()]
      .filter((a) => a.totalUnits > 0)
      .map((a) => ({
        user_id: userId,
        ticker: a.ticker,
        name: a.name ?? null,
        shares: a.totalUnits,
        cost_basis: a.totalCost / a.totalUnits,
        source: 'snaptrade' as const,
        updated_at: new Date().toISOString(),
      }))

    if (rows.length > 0) {
      // No last_price/day_change_* in this payload — Postgres upsert only
      // touches the columns present here, so refresh-quotes's fields (and
      // any manual notes/tags on an already-snaptrade row) are untouched.
      const { error: upsertErr } = await sb
        .from('holdings')
        .upsert(rows, { onConflict: 'user_id,ticker' })
      if (upsertErr) errors.push(`holdings upsert: ${upsertErr.message}`)
    }

    const status = errors.length ? (rows.length ? 'partial' : 'error') : 'ok'
    const finishedAt = new Date().toISOString()
    await finishRun(sb, runId, {
      status,
      tickers_count: rows.length,
      events_upserted: rows.length,
      error: errors.length ? errors.slice(0, 20).join(' | ') : null,
    })

    return json({
      ok: status !== 'error',
      status,
      tickers: rows.length,
      connections: authorizations.length,
      errors: errors.slice(0, 20),
      runId,
      finishedAt,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await finishRun(sb, runId, {
      status: 'error',
      tickers_count: 0,
      events_upserted: 0,
      error: msg,
    })
    return json({ error: `SnapTrade sync failed: ${msg}` }, 500)
  }
})

/**
 * AccountPosition shape confirmed against the real snaptrade-typescript-sdk
 * (v11.0.4) type definitions: `instrument.symbol` is a flat ticker string
 * for stock/etf/cef/adr/mutualfund kinds, `units` and `cost_basis` (the
 * per-share average purchase price — NOT `average_purchase_price`) are
 * numeric strings. Instrument kinds without a flat string symbol (options,
 * crypto, futures) are skipped here, not mis-parsed.
 */
function extractPosition(
  pos: unknown,
): { ticker: string; name?: string; units: number; avgPrice: number } | null {
  const p = pos as Record<string, unknown>
  const units = Number(p.units)
  if (!Number.isFinite(units) || units === 0) return null

  const instrument = p.instrument as Record<string, unknown> | undefined
  const ticker = instrument?.symbol
  if (typeof ticker !== 'string' || !ticker) return null

  const avgPrice = Number(p.cost_basis)
  const name = typeof instrument?.description === 'string' ? instrument.description : undefined

  return {
    ticker: ticker.toUpperCase(),
    name,
    units,
    avgPrice: Number.isFinite(avgPrice) ? avgPrice : 0,
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
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq('id', id)
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
