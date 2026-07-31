import type { Holding, PortfolioEvent, WatchlistItem } from '@/types'
import { getSupabase, isSupabaseConfigured, resolveBackend, type DataBackend } from '@/lib/supabase'
import {
  eventFromRow,
  holdingFromRow,
  holdingToUpdate,
  watchlistFromRow,
} from '@/lib/mappers'
import {
  loadEvents,
  loadHoldings,
  loadLastSync,
  loadWatchlist,
  resetToDemo as localResetToDemo,
  saveEvents,
  saveHoldings,
  saveWatchlist,
  setLastSync as localSetLastSync,
} from '@/lib/storage'

export interface PortfolioBundle {
  holdings: Holding[]
  watchlist: WatchlistItem[]
  events: PortfolioEvent[]
  lastSyncAt: string | null
  backend: DataBackend
}

export interface RepoError {
  message: string
  cause?: unknown
}

/**
 * Load portfolio for the active backend.
 * - local: localStorage (demo-seeded)
 * - supabase: authenticated user's rows + global macro events (user_id is null)
 */
export async function loadPortfolioBundle(userId: string | null): Promise<PortfolioBundle> {
  const backend = resolveBackend(Boolean(userId))

  if (backend === 'local') {
    return {
      holdings: loadHoldings(),
      watchlist: loadWatchlist(),
      events: loadEvents(),
      lastSyncAt: loadLastSync(),
      backend: 'local',
    }
  }

  const sb = getSupabase()
  if (!sb || !userId) {
    return {
      holdings: loadHoldings(),
      watchlist: loadWatchlist(),
      events: loadEvents(),
      lastSyncAt: loadLastSync(),
      backend: 'local',
    }
  }

  const [holdingsRes, watchRes, eventsRes, syncRes] = await Promise.all([
    sb.from('holdings').select('*').eq('user_id', userId).order('ticker'),
    sb.from('watchlist').select('*').eq('user_id', userId).order('ticker'),
    sb
      .from('events')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('event_date'),
    sb
      .from('sync_runs')
      .select('finished_at, started_at, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (holdingsRes.error) throw holdingsRes.error
  if (watchRes.error) throw watchRes.error
  if (eventsRes.error) throw eventsRes.error

  const holdings = (holdingsRes.data ?? []).map(holdingFromRow)
  const watchlist = (watchRes.data ?? []).map(watchlistFromRow)
  const events = (eventsRes.data ?? []).map(eventFromRow)

  // Mirror to local as offline cache
  saveHoldings(holdings)
  saveWatchlist(watchlist)
  if (events.length > 0) saveEvents(events)

  const lastSyncAt =
    syncRes.data?.finished_at ?? syncRes.data?.started_at ?? loadLastSync()

  if (lastSyncAt) localSetLastSync(lastSyncAt)

  return {
    holdings,
    watchlist,
    events: events.length > 0 ? events : loadEvents(),
    lastSyncAt,
    backend: 'supabase',
  }
}

/**
 * Always writes localStorage. When signed into Supabase, also upserts by (user_id, ticker).
 */
export async function persistHoldingsRemote(
  holdings: Holding[],
  userId: string | null,
): Promise<RepoError | null> {
  saveHoldings(holdings)
  if (resolveBackend(Boolean(userId)) !== 'supabase' || !userId) return null

  const sb = getSupabase()
  if (!sb) return null

  const tickers = new Set(holdings.map((h) => h.ticker.toUpperCase()))

  // Remove remote rows no longer in the client list
  const { data: existingHoldings, error: listErr } = await sb
    .from('holdings')
    .select('id, ticker')
    .eq('user_id', userId)
  if (listErr) return { message: listErr.message, cause: listErr }

  const deleteIds = (existingHoldings ?? [])
    .filter((r) => !tickers.has(r.ticker.toUpperCase()))
    .map((r) => r.id)

  if (deleteIds.length > 0) {
    const { error: delErr } = await sb.from('holdings').delete().in('id', deleteIds)
    if (delErr) return { message: delErr.message, cause: delErr }
  }

  if (holdings.length === 0) return null

  const rows = holdings.map((h) => ({
    user_id: userId,
    ...holdingToUpdate({
      ...h,
      ticker: h.ticker.toUpperCase(),
      updatedAt: h.updatedAt || new Date().toISOString(),
    }),
    created_at: h.createdAt || new Date().toISOString(),
  }))

  const { error } = await sb.from('holdings').upsert(rows, {
    onConflict: 'user_id,ticker',
  })
  if (error) return { message: error.message, cause: error }

  return null
}

export async function persistWatchlistRemote(
  items: WatchlistItem[],
  userId: string | null,
): Promise<RepoError | null> {
  saveWatchlist(items)
  if (resolveBackend(Boolean(userId)) !== 'supabase' || !userId) return null

  const sb = getSupabase()
  if (!sb) return null

  const tickers = new Set(items.map((w) => w.ticker.toUpperCase()))

  const { data: existingWatch, error: listErr } = await sb
    .from('watchlist')
    .select('id, ticker')
    .eq('user_id', userId)
  if (listErr) return { message: listErr.message, cause: listErr }

  const deleteIds = (existingWatch ?? [])
    .filter((r) => !tickers.has(r.ticker.toUpperCase()))
    .map((r) => r.id)

  if (deleteIds.length > 0) {
    const { error: delErr } = await sb.from('watchlist').delete().in('id', deleteIds)
    if (delErr) return { message: delErr.message, cause: delErr }
  }

  if (items.length === 0) return null

  const rows = items.map((w) => ({
    user_id: userId,
    ticker: w.ticker.toUpperCase(),
    name: w.name ?? null,
    notes: w.notes ?? null,
    tags: w.tags ?? [],
    created_at: w.createdAt || new Date().toISOString(),
  }))

  const { error } = await sb.from('watchlist').upsert(rows, {
    onConflict: 'user_id,ticker',
  })
  if (error) return { message: error.message, cause: error }

  return null
}

export function resetLocalDemo(): void {
  localResetToDemo()
}

export function markLocalSynced(iso = new Date().toISOString()): string {
  localSetLastSync(iso)
  return iso
}

export function getConfiguredFlag(): boolean {
  return isSupabaseConfigured()
}
