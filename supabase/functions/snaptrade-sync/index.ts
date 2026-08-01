/**
 * Portlander — snaptrade-sync Edge Function
 *
 * User-scoped (like refresh-quotes). Pulls the calling user's live brokerage
 * positions from SnapTrade and merges them into holdings — additive/merge,
 * never destructive: only tickers present in the sync get touched, manual/
 * CSV tickers the brokerage doesn't cover are left alone. Never writes
 * last_price/day_change_* — that stays refresh-quotes's (Finnhub) job.
 *
 * Mirrors snaptrade-connect's two customer models, selected by
 * SNAPTRADE_AUTH_MODE:
 *
 *   personal (default) — a Personal API Key. There is no per-user registration
 *     and no userSecret; every call omits userId/userSecret and reads the key
 *     owner's own brokerage account. Gated to a single Portlander user.
 *
 *   commercial — a Commercial API Key. Reads the caller's userSecret from
 *     snaptrade_users, written by snaptrade-connect at registration time.
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
 *   SNAPTRADE_AUTH_MODE        (optional: 'personal' | 'commercial', default 'personal')
 *   SNAPTRADE_OWNER_USER_ID    (optional: only needed in personal mode once this
 *                               project has more than one auth user)
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

  // .trim() guards against a stray leading/trailing newline or space from
  // copy-pasting into the Supabase Secrets dashboard — SnapTrade's HMAC
  // signature check fails outright (error 1076) on contaminated key material,
  // even though the value "looks right" visually.
  const clientId = Deno.env.get('SNAPTRADE_CLIENT_ID')?.trim()
  const consumerKey = Deno.env.get('SNAPTRADE_CONSUMER_KEY')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()

  if (!clientId || !consumerKey || !supabaseUrl || !anonKey || !serviceKey) {
    const missing = [
      !clientId && 'SNAPTRADE_CLIENT_ID',
      !consumerKey && 'SNAPTRADE_CONSUMER_KEY',
      !supabaseUrl && 'SUPABASE_URL',
      !anonKey && 'SUPABASE_ANON_KEY',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter((v): v is string => Boolean(v))
    console.error('[snaptrade-sync] missing secrets:', missing)
    return json({ error: `Missing secrets: ${missing.join(', ')}`, need: missing }, 500)
  }

  const authMode = resolveAuthMode()

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

  let api: SnaptradeReader
  if (authMode === 'personal') {
    const owner = await resolveOwnerUserId(sb)
    if (owner.error) return json({ error: owner.error }, 500)
    if (userId !== owner.ownerId) {
      return json({ error: PERSONAL_NOT_OWNER }, 403)
    }
    api = personalReader(clientId, consumerKey)
  } else {
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
    api = commercialReader(
      clientId,
      consumerKey,
      stUser.snaptrade_user_id as string,
      stUser.user_secret as string,
    )
  }

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
    const authorizations = await api.listBrokerageAuthorizations()
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

    const accounts = await api.listUserAccounts()

    const aggregated = new Map<
      string,
      { ticker: string; name?: string; totalUnits: number; totalCost: number }
    >()

    for (const account of accounts) {
      try {
        const positions = await api.getAllAccountPositions(account.id)
        for (const pos of positions) {
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
      mode: authMode,
      tickers: rows.length,
      connections: authorizations.length,
      errors: errors.slice(0, 20),
      runId,
      finishedAt,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const detail =
      e && typeof e === 'object' && 'toJSON' in e && typeof (e as { toJSON: unknown }).toJSON === 'function'
        ? (e as { toJSON: () => unknown }).toJSON()
        : e
    console.error('[snaptrade-sync] failed:', JSON.stringify(detail, null, 2))
    // axios's e.message is generic and never includes SnapTrade's actual JSON
    // rejection reason — surface responseBody directly, same as snaptrade-connect.
    const responseBody =
      e && typeof e === 'object' && 'responseBody' in e
        ? (e as { responseBody: unknown }).responseBody
        : undefined
    const bodySuffix = responseBody ? ` — ${JSON.stringify(responseBody)}` : ''
    const hint = authModeHint(responseBody, authMode)
    await finishRun(sb, runId, {
      status: 'error',
      tickers_count: 0,
      events_upserted: 0,
      error: `${msg}${bodySuffix}${hint}`,
    })
    return json({ error: `SnapTrade sync failed: ${msg}${bodySuffix}${hint}` }, 500)
  }
})

type AuthMode = 'personal' | 'commercial'

const PERSONAL_NOT_OWNER =
  'This Portlander instance is configured with a SnapTrade Personal API Key, which is permanently ' +
  "bound to the key owner's own brokerage account. Only the owner may connect or sync it. " +
  'To give every Portlander user their own brokerage connection, switch to a SnapTrade Commercial ' +
  'key and set SNAPTRADE_AUTH_MODE=commercial.'

interface BrokerageAuthorizationRow {
  id?: string
  name?: string
  brokerage?: { display_name?: string; name?: string }
}

/**
 * The only thing that differs between the two customer models is whether
 * userId/userSecret ride along with each request — a personal key rejects them
 * (they're typed `never` in the SDK), a commercial key requires them. Narrowing
 * to the three reads this function needs keeps that difference in one place and
 * lets each mode build a concretely-typed SDK client.
 */
interface SnaptradeReader {
  listBrokerageAuthorizations(): Promise<BrokerageAuthorizationRow[]>
  listUserAccounts(): Promise<{ id: string }[]>
  getAllAccountPositions(accountId: string): Promise<unknown[]>
}

function personalReader(clientId: string, consumerKey: string): SnaptradeReader {
  const snaptrade = new Snaptrade({
    auth: SnaptradeAuth.personalApiKey({ clientId, consumerKey }),
  })
  return {
    async listBrokerageAuthorizations() {
      const res = await snaptrade.connections.listBrokerageAuthorizations()
      return res.data ?? []
    },
    async listUserAccounts() {
      const res = await snaptrade.accountInformation.listUserAccounts()
      return res.data ?? []
    },
    async getAllAccountPositions(accountId) {
      const res = await snaptrade.accountInformation.getAllAccountPositions({ accountId })
      return res.data?.results ?? []
    },
  }
}

function commercialReader(
  clientId: string,
  consumerKey: string,
  userId: string,
  userSecret: string,
): SnaptradeReader {
  const snaptrade = new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
  })
  return {
    async listBrokerageAuthorizations() {
      const res = await snaptrade.connections.listBrokerageAuthorizations({ userId, userSecret })
      return res.data ?? []
    },
    async listUserAccounts() {
      const res = await snaptrade.accountInformation.listUserAccounts({ userId, userSecret })
      return res.data ?? []
    },
    async getAllAccountPositions(accountId) {
      const res = await snaptrade.accountInformation.getAllAccountPositions({
        accountId,
        userId,
        userSecret,
      })
      return res.data?.results ?? []
    },
  }
}

/** Defaults to 'personal'; only an explicit 'commercial' opts into the multi-tenant flow. */
function resolveAuthMode(): AuthMode {
  return Deno.env.get('SNAPTRADE_AUTH_MODE')?.trim().toLowerCase() === 'commercial'
    ? 'commercial'
    : 'personal'
}

/**
 * A Personal API Key exposes exactly one brokerage account — the key owner's —
 * so exactly one Portlander user may reach it. SNAPTRADE_OWNER_USER_ID names
 * that user explicitly; when it's unset we can still resolve it unambiguously
 * as long as this project has a single auth user (the common single-owner
 * install). With more than one, refuse rather than guess: picking wrong would
 * hand one user another's live brokerage holdings.
 */
async function resolveOwnerUserId(
  sb: ReturnType<typeof createClient>,
): Promise<{ ownerId?: string; error?: string }> {
  const explicit = Deno.env.get('SNAPTRADE_OWNER_USER_ID')?.trim()
  if (explicit) return { ownerId: explicit }

  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 2 })
  if (error) {
    return { error: `Could not determine the SnapTrade key owner: ${error.message}` }
  }
  const users = data?.users ?? []
  if (users.length === 1) return { ownerId: users[0].id }

  return {
    error:
      `Cannot determine which Portlander user owns the SnapTrade Personal key ` +
      `(this project has ${users.length === 0 ? 'no' : 'more than one'} auth user). ` +
      `Set SNAPTRADE_OWNER_USER_ID to that user's Supabase id.`,
  }
}

/**
 * SnapTrade's own error codes name the customer-model mismatch precisely — pass
 * that through as an actionable next step instead of leaving a bare code.
 */
function authModeHint(responseBody: unknown, authMode: AuthMode): string {
  const code =
    responseBody && typeof responseBody === 'object' && 'code' in responseBody
      ? String((responseBody as { code: unknown }).code)
      : undefined

  if (code === '1012' && authMode === 'commercial') {
    return ' — these are Personal API Key credentials; remove SNAPTRADE_AUTH_MODE (or set it to "personal") and redeploy.'
  }
  if (code === '1076' && authMode === 'personal') {
    return ' — signature rejected in personal mode; if these are Commercial API Key credentials, set SNAPTRADE_AUTH_MODE=commercial and redeploy.'
  }
  return ''
}

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
