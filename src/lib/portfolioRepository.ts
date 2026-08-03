import type { BrokerageConnection, Holding, PortfolioEvent, WatchlistItem } from '@/types'
import type { PerformanceNarrative, PerformanceSummary, PositionSnapshot } from '@/types/performance'
import { getSupabase, resolveBackend, type DataBackend } from '@/lib/supabase'
import {
  brokerageConnectionFromRow,
  eventFromRow,
  holdingFromRow,
  holdingToWrite,
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

function numeric(value: number | string): number {
  return typeof value === 'number' ? value : Number(value)
}

async function describeFunctionError(error: { message: string; context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body = await error.context.clone().json()
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // Fall through to the generic transport message.
    }
  }
  return error.message
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
 * Upserts exactly the given rows — never touches a holding absent from `rows`.
 * Local caching is the caller's responsibility (see `saveHoldings`); this only
 * fires the remote write, and only when signed into Supabase.
 */
export async function upsertHoldingsRemote(
  rows: Holding[],
  userId: string | null,
): Promise<RepoError | null> {
  if (rows.length === 0) return null
  if (resolveBackend(Boolean(userId)) !== 'supabase' || !userId) return null

  const sb = getSupabase()
  if (!sb) return null

  const payload = rows.map((h) => ({
    user_id: userId,
    ...holdingToWrite({
      ...h,
      ticker: h.ticker.toUpperCase(),
      updatedAt: h.updatedAt || new Date().toISOString(),
    }),
  }))

  const { error } = await sb.from('holdings').upsert(payload, {
    onConflict: 'user_id,ticker',
  })
  if (error) return { message: error.message, cause: error }

  return null
}

/**
 * Deletes exactly the given ids. Brokerage-synced rows are excluded at the
 * query level (`neq('source', 'snaptrade')`), not by trusting the caller to
 * have filtered them out first — only snaptrade-sync may remove a synced
 * row, because only it can tell "sold at the brokerage" from "this client
 * isn't holding a complete list right now". Local caching is the caller's
 * responsibility (see `saveHoldings`); this only fires the remote delete,
 * and only when signed into Supabase.
 */
export async function deleteHoldingsRemote(
  ids: string[],
  userId: string | null,
): Promise<RepoError | null> {
  if (ids.length === 0) return null
  if (resolveBackend(Boolean(userId)) !== 'supabase' || !userId) return null

  const sb = getSupabase()
  if (!sb) return null

  const { error } = await sb
    .from('holdings')
    .delete()
    .eq('user_id', userId)
    .in('id', ids)
    .neq('source', 'snaptrade')
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

/** Loads only complete captures and keeps the latest complete capture per day. */
export async function loadPerformanceSnapshots(
  startDate: string,
  endDate: string,
  userId: string | null,
): Promise<{ snapshots: PositionSnapshot[]; error: RepoError | null }> {
  if (resolveBackend(Boolean(userId)) !== 'supabase' || !userId) {
    return { snapshots: [], error: null }
  }
  const sb = getSupabase()
  if (!sb) return { snapshots: [], error: { message: 'Supabase is not configured' } }

  const { data: headers, error: headerErr } = await sb
    .from('portfolio_snapshots')
    .select('id, snapshot_date, captured_at')
    .eq('user_id', userId)
    .eq('is_complete', true)
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('captured_at', { ascending: false })
  if (headerErr) return { snapshots: [], error: { message: headerErr.message, cause: headerErr } }

  const latestByDate = new Map<string, { id: string; snapshot_date: string; captured_at: string }>()
  for (const header of headers ?? []) {
    if (!latestByDate.has(header.snapshot_date)) latestByDate.set(header.snapshot_date, header)
  }
  const selected = [...latestByDate.values()]
  if (selected.length === 0) return { snapshots: [], error: null }

  const headerById = new Map(selected.map((header) => [header.id, header]))
  const { data: positions, error: positionErr } = await sb
    .from('position_snapshots')
    .select('snapshot_id, ticker, name, shares, price, market_value, tags, source')
    .eq('user_id', userId)
    .in('snapshot_id', selected.map((header) => header.id))
    .order('ticker')
  if (positionErr) return { snapshots: [], error: { message: positionErr.message, cause: positionErr } }

  const snapshots = (positions ?? [])
    .flatMap((row): PositionSnapshot[] => {
      const header = headerById.get(row.snapshot_id)
      if (!header) return []
      const source = row.source === 'csv' || row.source === 'manual' ? row.source : 'snaptrade'
      return [{
        snapshotId: row.snapshot_id,
        snapshotDate: header.snapshot_date,
        capturedAt: header.captured_at,
        ticker: row.ticker,
        name: row.name ?? undefined,
        shares: numeric(row.shares),
        price: numeric(row.price),
        marketValue: numeric(row.market_value),
        tags: row.tags ?? [],
        source,
      }]
    })
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate) || a.ticker.localeCompare(b.ticker))

  return { snapshots, error: null }
}

function itemDirection(value: number): 'gain' | 'loss' | 'flat' {
  if (Math.abs(value) < 0.005) return 'flat'
  return value > 0 ? 'gain' : 'loss'
}

/**
 * Requests qualitative, cached narration. Exact values never enter this
 * request and never come back from the model; the UI joins selected IDs back
 * to its deterministic summary.
 */
export async function generatePerformanceNarrativeRemote(
  summary: PerformanceSummary,
): Promise<{ narrative: PerformanceNarrative | null; error: RepoError | null }> {
  const sb = getSupabase()
  if (!sb) return { narrative: null, error: { message: 'Supabase is not configured' } }
  const facts = (items: PerformanceSummary['tickerAttribution']) =>
    items.slice(0, 5).map((item, index) => ({
      id: item.id,
      label: item.label,
      direction: itemDirection(item.valueChange),
      rank: index + 1,
    }))
  const periodLabel = summary.period === 'day' ? 'today' : summary.period === 'week' ? 'this week' : 'selected period'
  const { data, error } = await sb.functions.invoke('portfolio-recap', {
    method: 'POST',
    body: {
      summaryKey: summary.summaryKey,
      periodStart: summary.effectiveStartDate,
      periodEnd: summary.effectiveEndDate,
      periodLabel,
      direction: summary.direction,
      hasPositionChanges: summary.hasPositionChanges,
      themes: facts(summary.themeAttribution),
      tickers: facts(summary.tickerAttribution),
    },
  })
  if (error) return { narrative: null, error: { message: await describeFunctionError(error), cause: error } }
  if (
    typeof data?.headline !== 'string' ||
    typeof data?.narrative !== 'string' ||
    !Array.isArray(data?.selectedTickerIds) ||
    !Array.isArray(data?.selectedThemeIds) ||
    typeof data?.model !== 'string' ||
    typeof data?.generatedAt !== 'string'
  ) {
    return { narrative: null, error: { message: 'Portfolio recap returned malformed data', cause: data } }
  }
  return {
    narrative: {
      headline: data.headline,
      narrative: data.narrative,
      selectedTickerIds: data.selectedTickerIds,
      selectedThemeIds: data.selectedThemeIds,
      model: data.model,
      generatedAt: data.generatedAt,
    },
    error: null,
  }
}

export function resetLocalDemo(): void {
  localResetToDemo()
}
