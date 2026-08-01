import type { BrokerageConnection, Holding, PortfolioEvent, WatchlistItem } from '@/types'
import { getSupabase, resolveBackend, type DataBackend } from '@/lib/supabase'
import {
  brokerageConnectionFromRow,
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
  setQuotesLastSync as localSetQuotesLastSync,
} from '@/lib/storage'

/** Freshness per Edge Function, keyed by what it writes rather than its provider name. */
export interface SyncTimestamps {
  positions: string | null
  prices: string | null
  events: string | null
}

export interface PortfolioBundle {
  holdings: Holding[]
  watchlist: WatchlistItem[]
  events: PortfolioEvent[]
  lastSyncAt: string | null
  syncTimestamps: SyncTimestamps
  backend: DataBackend
  brokerageConnections: BrokerageConnection[]
}

const EMPTY_SYNC_TIMESTAMPS: SyncTimestamps = { positions: null, prices: null, events: null }

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
      syncTimestamps: EMPTY_SYNC_TIMESTAMPS,
      backend: 'local',
      brokerageConnections: [],
    }
  }

  const sb = getSupabase()
  if (!sb || !userId) {
    return {
      holdings: loadHoldings(),
      watchlist: loadWatchlist(),
      events: loadEvents(),
      lastSyncAt: loadLastSync(),
      syncTimestamps: EMPTY_SYNC_TIMESTAMPS,
      backend: 'local',
      brokerageConnections: [],
    }
  }

  const lastRunByProvider = (provider: string) =>
    sb
      .from('sync_runs')
      .select('finished_at, started_at, status')
      .eq('provider', provider)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

  const [holdingsRes, watchRes, eventsRes, positionsSyncRes, pricesSyncRes, eventsSyncRes, connectionsRes] =
    await Promise.all([
      sb.from('holdings').select('*').eq('user_id', userId).order('ticker'),
      sb.from('watchlist').select('*').eq('user_id', userId).order('ticker'),
      sb
        .from('events')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('event_date'),
      lastRunByProvider('snaptrade-positions'),
      lastRunByProvider('finnhub-quotes'),
      lastRunByProvider('finnhub'),
      sb.from('snaptrade_connections').select('*').eq('user_id', userId).order('connected_at'),
    ])

  if (holdingsRes.error) throw holdingsRes.error
  if (watchRes.error) throw watchRes.error
  if (eventsRes.error) throw eventsRes.error

  const holdings = (holdingsRes.data ?? []).map(holdingFromRow)
  const watchlist = (watchRes.data ?? []).map(watchlistFromRow)
  const events = (eventsRes.data ?? []).map(eventFromRow)
  const brokerageConnections = (connectionsRes.data ?? []).map(brokerageConnectionFromRow)

  // Mirror to local as offline cache
  saveHoldings(holdings)
  saveWatchlist(watchlist)
  if (events.length > 0) saveEvents(events)

  const runTimestamp = (res: { data: { finished_at: string | null; started_at: string } | null }) =>
    res.data?.finished_at ?? res.data?.started_at ?? null

  const syncTimestamps: SyncTimestamps = {
    positions: runTimestamp(positionsSyncRes),
    prices: runTimestamp(pricesSyncRes),
    events: runTimestamp(eventsSyncRes),
  }

  const lastSyncAt =
    [syncTimestamps.positions, syncTimestamps.prices, syncTimestamps.events]
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? loadLastSync()

  if (lastSyncAt) localSetLastSync(lastSyncAt)

  return {
    holdings,
    watchlist,
    events: events.length > 0 ? events : loadEvents(),
    lastSyncAt,
    syncTimestamps,
    backend: 'supabase',
    brokerageConnections,
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
    .select('id, ticker, source')
    .eq('user_id', userId)
  if (listErr) return { message: listErr.message, cause: listErr }

  // Brokerage-owned rows are never deleted by a browser write, whatever the
  // client list happens to contain. Only snaptrade-sync may remove them — it
  // alone can tell "sold at Fidelity" from "this client just isn't holding a
  // complete list right now". Without this guard a single CSV import, which
  // parses to manual rows only, deletes every synced position.
  const deleteIds = (existingHoldings ?? [])
    .filter((r) => r.source !== 'snaptrade' && !tickers.has(r.ticker.toUpperCase()))
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

export interface QuoteRefreshResult {
  ticker: string
  lastPrice: number
  dayChangeValue: number | null
  dayChangePct: number | null
}

export interface QuoteRefreshOutcome {
  results: QuoteRefreshResult[]
  tickersAttempted: number
  errors: string[]
  finishedAt: string | null
}

/**
 * Invokes the refresh-quotes Edge Function for the signed-in user's holdings.
 * Deliberately does not touch events/watchlist — price-only, on-demand refresh.
 */
export async function refreshQuotesRemote(): Promise<{
  error: RepoError | null
  outcome: QuoteRefreshOutcome | null
}> {
  const sb = getSupabase()
  if (!sb) return { error: { message: 'Supabase is not configured' }, outcome: null }

  const { data, error } = await sb.functions.invoke('refresh-quotes', { method: 'POST' })
  if (error) return { error: { message: error.message, cause: error }, outcome: null }
  if (data?.status === 'error') {
    return {
      error: { message: data.errors?.[0] ?? 'Quote refresh failed', cause: data },
      outcome: null,
    }
  }

  const finishedAt = data?.finishedAt ?? null
  if (finishedAt) localSetQuotesLastSync(finishedAt)

  return {
    error: null,
    outcome: {
      results: data?.results ?? [],
      tickersAttempted: data?.tickers ?? 0,
      errors: data?.errors ?? [],
      finishedAt,
    },
  }
}

/** Patches only lastPrice/dayChange fields/updatedAt for matched tickers; mirrors to local cache. */
export function applyQuoteResultsLocally(
  current: Holding[],
  results: QuoteRefreshResult[],
): Holding[] {
  if (results.length === 0) return current
  const byTicker = new Map(results.map((r) => [r.ticker.toUpperCase(), r]))
  const now = new Date().toISOString()
  const next = current.map((h) => {
    const r = byTicker.get(h.ticker.toUpperCase())
    if (!r) return h
    return {
      ...h,
      lastPrice: r.lastPrice,
      dayChangeValue: r.dayChangeValue ?? undefined,
      dayChangePct: r.dayChangePct ?? undefined,
      updatedAt: now,
    }
  })
  saveHoldings(next)
  return next
}

export function resetLocalDemo(): void {
  localResetToDemo()
}

