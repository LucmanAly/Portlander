/**
 * Portlander — snaptrade-connect Edge Function
 *
 * User-scoped (like refresh-quotes, not global like sync-events). Returns a
 * short-lived Connection Portal URL for the caller to link a brokerage.
 *
 * Two SnapTrade customer models are supported, selected by SNAPTRADE_AUTH_MODE:
 *
 *   personal (default) — a Personal API Key. SnapTrade provisions exactly one
 *     SnapTrade user alongside the key at signup, so there is nothing to
 *     register: /snapTrade/registerUser rejects personal keys outright with
 *     400 code 1012, and every other call must omit userId/userSecret. Since
 *     the key is permanently bound to the key owner's own brokerage account,
 *     this mode is gated to a single Portlander user (resolveOwnerUserId).
 *
 *   commercial — a Commercial API Key (the multi-tenant model). Each Portlander
 *     user is registered with SnapTrade on first use and gets their own
 *     userSecret, stored in snaptrade_users and never sent to the browser.
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
 * Invoke: only via the SPA (supabase.functions.invoke('snaptrade-connect')),
 * which attaches the signed-in user's session token automatically. The
 * returned redirectUrl expires in ~5 minutes — open it immediately.
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
    console.error('[snaptrade-connect] missing secrets:', missing)
    return json({ error: `Missing secrets: ${missing.join(', ')}`, need: missing }, 500)
  }

  const authMode = resolveAuthMode()

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  // Resolve the CALLING user's identity from their own JWT, same pattern as
  // refresh-quotes — verify_jwt:true already validated the token at the
  // gateway; this recovers identity in a supported way.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const userId = userData.user.id
  const snaptradeUserId = `portlander_${userId}`

  let broker: string | undefined
  try {
    const body = await req.json()
    if (body && typeof body.broker === 'string') broker = body.broker
  } catch {
    // No body / not JSON — broker selection screen is shown instead.
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    if (authMode === 'personal') {
      const owner = await resolveOwnerUserId(sb)
      if (owner.error) return json({ error: owner.error }, 500)
      if (userId !== owner.ownerId) {
        return json({ error: PERSONAL_NOT_OWNER }, 403)
      }

      // No registration step and no userId/userSecret: a personal key already
      // *is* the user. connectionType 'read' keeps the connection read-only —
      // Portlander never places trades.
      const snaptrade = new Snaptrade({
        auth: SnaptradeAuth.personalApiKey({ clientId, consumerKey }),
      })
      const portalRes = await snaptrade.authentication.loginSnapTradeUser({
        broker,
        connectionType: 'read',
      })
      return json({ ok: true, mode: authMode, redirectUrl: readRedirectUrl(portalRes.data) })
    }

    const snaptrade = new Snaptrade({
      auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
    })

    const { data: existing, error: fetchErr } = await sb
      .from('snaptrade_users')
      .select('user_secret')
      .eq('user_id', userId)
      .maybeSingle()
    if (fetchErr) throw fetchErr

    let userSecret = existing?.user_secret as string | undefined

    if (!userSecret) {
      const registerRes = await snaptrade.authentication.registerSnapTradeUser({
        userId: snaptradeUserId,
      })
      userSecret = registerRes.data.userSecret
      if (!userSecret) throw new Error('SnapTrade did not return a userSecret')

      const { error: insertErr } = await sb.from('snaptrade_users').insert({
        user_id: userId,
        snaptrade_user_id: snaptradeUserId,
        user_secret: userSecret,
      })
      if (insertErr) throw insertErr
    }

    const portalRes = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserId,
      userSecret,
      broker,
      connectionType: 'read',
    })

    return json({ ok: true, mode: authMode, redirectUrl: readRedirectUrl(portalRes.data) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // SnaptradeError (the SDK's own error class) carries responseBody/status/code —
    // log the full detail server-side since the client only ever sees a generic
    // "non-2xx status code" message, not this response body.
    const detail =
      e && typeof e === 'object' && 'toJSON' in e && typeof (e as { toJSON: unknown }).toJSON === 'function'
        ? (e as { toJSON: () => unknown }).toJSON()
        : e
    console.error('[snaptrade-connect] failed:', JSON.stringify(detail, null, 2))
    // axios's e.message is generic ("Request failed with status code 401") and
    // never includes SnapTrade's actual JSON rejection reason — surface
    // responseBody directly since we have no working channel to read
    // console.error output back out of Supabase's logs.
    const responseBody =
      e && typeof e === 'object' && 'responseBody' in e
        ? (e as { responseBody: unknown }).responseBody
        : undefined
    const bodySuffix = responseBody ? ` — ${JSON.stringify(responseBody)}` : ''
    const hint = authModeHint(responseBody, authMode)
    return json({ error: `SnapTrade connect failed: ${msg}${bodySuffix}${hint}` }, 500)
  }
})

type AuthMode = 'personal' | 'commercial'

const PERSONAL_NOT_OWNER =
  'This Portlander instance is configured with a SnapTrade Personal API Key, which is permanently ' +
  "bound to the key owner's own brokerage account. Only the owner may connect or sync it. " +
  'To give every Portlander user their own brokerage connection, switch to a SnapTrade Commercial ' +
  'key and set SNAPTRADE_AUTH_MODE=commercial.'

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

function readRedirectUrl(data: unknown): string {
  const url = data && typeof data === 'object' && 'redirectURI' in data
    ? (data as { redirectURI?: unknown }).redirectURI
    : undefined
  if (typeof url !== 'string' || !url) {
    throw new Error('SnapTrade did not return a connection portal URL')
  }
  return url
}

/**
 * SnapTrade's own error codes name the customer-model mismatch precisely — pass
 * that through as an actionable next step instead of leaving a bare code.
 * 1012: personal key used against a commercial-only endpoint (registerUser).
 * 1076: bad signature — with a personal key that usually means the wrong mode.
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
