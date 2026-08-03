import type { HoldingSource } from '@/types'

export type PerformancePeriod = 'day' | 'week' | 'range'
export type PerformanceDirection = 'gain' | 'loss' | 'flat'

export interface PositionSnapshot {
  snapshotId: string
  snapshotDate: string
  capturedAt: string
  ticker: string
  name?: string
  shares: number
  price: number
  marketValue: number
  tags: string[]
  source: HoldingSource
}

export interface PerformanceAttribution {
  id: string
  label: string
  tickers: string[]
  startValue: number
  endValue: number
  valueChange: number
  pctChange?: number
}

export interface PerformanceSummary {
  period: PerformancePeriod
  requestedStartDate: string
  requestedEndDate: string
  effectiveStartDate: string
  effectiveEndDate: string
  startValue: number
  endValue: number
  valueChange: number
  pctChange?: number
  direction: PerformanceDirection
  hasPositionChanges: boolean
  overlappingThemes: boolean
  holdingsCount: number
  summaryKey: string
  tickerAttribution: PerformanceAttribution[]
  themeAttribution: PerformanceAttribution[]
}

export interface PerformanceNarrative {
  headline: string
  narrative: string
  selectedTickerIds: string[]
  selectedThemeIds: string[]
  model: string
  generatedAt: string
}
