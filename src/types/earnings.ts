import type { EventTiming } from '@/types'

/**
 * Event-intelligence presentation model for earnings cards/drawers (UX-02+).
 *
 * Distinct from `ScoredEvent` (src/types/index.ts): a `ScoredEvent` is what the
 * real Finnhub/macro sync pipeline produces today. An `EarningsCardModel` wraps
 * one on top with additional, currently-fixture-sourced facts (consensus,
 * actuals, surprise, guidance, reaction, provenance, history) that no live data
 * source in this app populates yet — see src/data/earningsFixtures.ts. Swapping
 * the fixture lookup for a real provider later is a data-source change only;
 * this type's shape is designed not to need to change for that.
 */
export type EarningsViewState = 'upcoming' | 'awaiting' | 'reported'

export type GuidanceDirection = 'raised' | 'maintained' | 'lowered' | 'withdrawn' | 'none'
export type ReactionDirection = 'up' | 'down' | 'flat'

export interface ConsensusEstimate {
  epsEstimate?: number
  revenueEstimate?: number
  epsEstimateCount?: number
  revenueEstimateCount?: number
}

export interface ActualResults {
  epsActual?: number
  revenueActual?: number
}

export interface SurpriseMetrics {
  epsSurprisePct?: number
  epsSurpriseAbs?: number
  revenueSurprisePct?: number
  revenueSurpriseAbs?: number
}

export interface GuidanceInfo {
  direction: GuidanceDirection
  note?: string
}

export interface ReactionInfo {
  direction: ReactionDirection
  pricePct?: number
  asOf?: string
}

export interface ProvenanceInfo {
  source: string
  fetchedAt?: string
  /** Mirrors the Portfolio table's `~` estimated-value convention (isEstimatedValue in scoring.ts). */
  isEstimateFallback?: boolean
}

export interface HistoricalBeat {
  quarter: string
  /** null = unknown/not tracked for that quarter, not "missed". */
  epsBeat: boolean | null
  revenueBeat: boolean | null
}

export interface GeneratedInterpretation {
  summary: string
  model?: string
  generatedAt?: string
  confidence?: 'low' | 'medium' | 'high'
}

export interface EarningsFacts {
  consensus?: ConsensusEstimate
  actual?: ActualResults
  surprise?: SurpriseMetrics
  guidance?: GuidanceInfo
  reaction?: ReactionInfo
  provenance?: ProvenanceInfo
  history?: HistoricalBeat[]
}

export interface EarningsCardModel {
  id: string
  ticker: string
  companyName?: string
  title: string
  eventDate: string
  eventTime?: string | null
  timing: EventTiming
  viewState: EarningsViewState
  isHolding: boolean
  isWatchlist: boolean
  positionWeightPct: number
  marketValue: number
  impactScore: number
  facts?: EarningsFacts
  /**
   * Deliberately a sibling of `facts`, not nested inside it — keeps the
   * verified/generated split enforceable at the type level rather than by
   * convention (a caller iterating "facts" can't accidentally include this).
   */
  interpretation?: GeneratedInterpretation
}
