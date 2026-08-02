export type EventType = 'earnings' | 'ex_div' | 'pay_div' | 'fomc' | 'cpi' | 'nfp' | 'other_macro'

export type EventTiming = 'bmo' | 'amc' | 'unknown'
export type EventStatus = 'confirmed' | 'estimated'
export type EventFilter = 'all' | 'earnings' | 'dividends' | 'macro' | 'holdings'

export type HoldingSource = 'manual' | 'csv' | 'snaptrade'

export interface Holding {
  id: string
  ticker: string
  name?: string
  shares: number
  /** Optional manual portfolio weight override (0–100). Prefer over computed when set. */
  weightOverridePct?: number
  costBasis?: number
  /** Last price for market value; demo/mock until EOD sync */
  lastPrice?: number
  /** Absolute day change in price, from the last "Refresh prices" run */
  dayChangeValue?: number
  /** Day change in price as a percent, from the last "Refresh prices" run */
  dayChangePct?: number
  tags?: string[]
  notes?: string
  /** 'snaptrade' rows are authoritative live-brokerage data; 'manual'/'csv' are fallbacks. */
  source: HoldingSource
  createdAt: string
  updatedAt: string
}

export interface BrokerageConnection {
  id: string
  brokerageName: string
  authorizationId: string
  connectedAt: string
}

export interface WatchlistItem {
  id: string
  ticker: string
  name?: string
  notes?: string
  tags?: string[]
  createdAt: string
}

export interface PortfolioEvent {
  id: string
  ticker: string | null
  title: string
  eventType: EventType
  eventDate: string // YYYY-MM-DD
  eventTime?: string | null
  timing: EventTiming
  status: EventStatus
  source?: string
  /** Optional notes from data provider */
  description?: string
  /**
   * Raw provider payload as stored by sync-events (Finnhub's earnings-calendar
   * row for `earnings` events today). Only earningsIntel.ts's
   * earningsFactsFromRaw() interprets this shape — kept opaque here so this
   * generic event type doesn't grow a Finnhub-specific dependency.
   */
  raw?: Record<string, unknown> | null
  updatedAt?: string
  /**
   * `events.ai_interpretation` (BE-06) — a DeepSeek-generated structured
   * interpretation, written only by the `earnings-interpret` Edge Function
   * after strict schema validation. Kept opaque here for the same reason as
   * `raw`: only earningsIntel.ts's interpretationFromRaw() parses this shape,
   * and re-validates it on read rather than trusting the stored value.
   */
  interpretation?: Record<string, unknown> | null
}

export interface ScoredEvent extends PortfolioEvent {
  positionWeightPct: number
  impactScore: number
  impactBreakdown: {
    weightComponent: number
    typeComponent: number
    recencyComponent: number
  }
  isHolding: boolean
  isWatchlist: boolean
  marketValue: number
}

export interface ExposureSummary {
  earnings7dPct: number
  earnings30dPct: number
  nextCritical: ScoredEvent | null
  totalPortfolioValue: number
  holdingsCount: number
}

export interface PortfolioState {
  holdings: Holding[]
  watchlist: WatchlistItem[]
  events: PortfolioEvent[]
  lastSyncAt: string | null
}
