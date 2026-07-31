/**
 * Portlander — snaptrade-connect Edge Function
 *
 * User-scoped (like refresh-quotes, not global like sync-events). Registers
 * the calling user with SnapTrade on first use (storing the returned
 * userSecret in snaptrade_users, never sent to the browser), then returns a
 * short-lived Connection Portal URL for the user to link a brokerage.
 *
 * Secrets (supabase secrets set):
 *   SNAPTRADE_CLIENT_ID
 *   SNAPTRADE_CONSUMER_KEY
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

  const clientId = Deno.env.get('SNAPTRADE_CLIENT_ID')
  const consumerKey = Deno.env.get('SNAPTRADE_CONSUMER_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!clientId || !consumerKey || !supabaseUrl || !anonKey || !serviceKey) {
    console.error('[snaptrade-connect] missing secrets:', {
      clientId: !!clientId,
      consumerKey: !!consumerKey,
      supabaseUrl: !!supabaseUrl,
      anonKey: !!anonKey,
      serviceKey: !!serviceKey,
    })
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

  const snaptrade = new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
  })

  try {
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
    })
    const redirectUrl =
      'redirectURI' in portalRes.data ? portalRes.data.redirectURI : undefined
    if (!redirectUrl) throw new Error('SnapTrade did not return a connection portal URL')

    return json({ ok: true, redirectUrl })
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
    return json({ error: `SnapTrade connect failed: ${msg}` }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
