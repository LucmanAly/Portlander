export type PerformanceBasis = 'live-quote' | 'daily-snapshots'
export type PerformanceCoverage = 'complete' | 'partial' | 'unavailable'

export interface PerformanceSnapshot {
  snapshotDate: string
  ticker: string
  shares: number
  price: number
  previousClose: number
  marketValue: number
  dayChangeValue: number
  dayChangePct?: number
  tags: string[]
  capturedAt: string
}

export interface PerformanceSnapshotRun {
  snapshotDate: string
  status: 'ok' | 'partial' | 'error'
  expectedPositions: number
  capturedPositions: number
  missingTickers: string[]
  capturedAt: string
}

export interface PerformanceContributor {
  key: string
  label: string
  pnlValue: number
  returnPct?: number
  openingValue: number
  closingValue: number
  tickers: string[]
}

export interface PerformanceSummary {
  startDate: string
  endDate: string
  basis: PerformanceBasis
  coverage: PerformanceCoverage
  coveredDates: string[]
  expectedPositions: number
  coveredPositions: number
  totalPnlValue?: number
  totalReturnPct?: number
  openingValue?: number
  closingValue?: number
  themes: PerformanceContributor[]
  holdings: PerformanceContributor[]
  evidenceHash: string
  limitations: string[]
}

export interface GeneratedPerformanceNarrative {
  headline: string
  summary: string
  model: string
  generatedAt: string
  cached: boolean
}
