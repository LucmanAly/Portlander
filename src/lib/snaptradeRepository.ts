import { getSupabase } from '@/lib/supabase'
import type { RepoError } from '@/lib/portfolioRepository'

/**
 * supabase-js's FunctionsHttpError only carries a generic "Edge Function
 * returned a non-2xx status code" message — the actual JSON body our
 * functions return (with the real error detail) is on error.context, a raw
 * Response object that has to be read separately.
 */
async function describeFunctionError(error: { message: string; context?: unknown }): Promise<string> {
  const context = error.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json()
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // Body wasn't JSON or already consumed — fall through to the generic message.
    }
  }
  return error.message
}

/**
 * Invokes snaptrade-connect. Registers the user with SnapTrade on first call
 * (server-side, userSecret never reaches the browser) and returns a
 * Connection Portal URL — expires in ~5 minutes, open it immediately.
 */
export async function connectBrokerage(broker?: string): Promise<{
  error: RepoError | null
  redirectUrl: string | null
}> {
  const sb = getSupabase()
  if (!sb) return { error: { message: 'Supabase is not configured' }, redirectUrl: null }

  const { data, error } = await sb.functions.invoke('snaptrade-connect', {
    method: 'POST',
    body: broker ? { broker } : {},
  })
  if (error) return { error: { message: await describeFunctionError(error), cause: error }, redirectUrl: null }
  if (!data?.redirectUrl) {
    return { error: { message: data?.error ?? 'No connection URL returned', cause: data }, redirectUrl: null }
  }

  return { error: null, redirectUrl: data.redirectUrl as string }
}

export interface BrokerageSyncOutcome {
  tickers: number
  connections: number
  errors: string[]
  finishedAt: string | null
}

/** Invokes snaptrade-sync. Merges live brokerage positions into holdings. */
export async function syncBrokerage(): Promise<{
  error: RepoError | null
  outcome: BrokerageSyncOutcome | null
}> {
  const sb = getSupabase()
  if (!sb) return { error: { message: 'Supabase is not configured' }, outcome: null }

  const { data, error } = await sb.functions.invoke('snaptrade-sync', { method: 'POST' })
  if (error) return { error: { message: await describeFunctionError(error), cause: error }, outcome: null }
  if (data?.status === 'error') {
    return {
      error: { message: data.errors?.[0] ?? 'Brokerage sync failed', cause: data },
      outcome: null,
    }
  }

  return {
    error: null,
    outcome: {
      tickers: data?.tickers ?? 0,
      connections: data?.connections ?? 0,
      errors: data?.errors ?? [],
      finishedAt: data?.finishedAt ?? null,
    },
  }
}
