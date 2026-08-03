import type { Holding } from '@/types'
import type {
  PerformanceAttribution,
  PerformanceDirection,
  PerformancePeriod,
  PerformanceSummary,
  PositionSnapshot,
} from '@/types/performance'

function direction(value: number): PerformanceDirection {
  if (Math.abs(value) < 0.005) return 'flat'
  return value > 0 ? 'gain' : 'loss'
}

function pct(change: number, start: number): number | undefined {
  return start === 0 ? undefined : (change / Math.abs(start)) * 100
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function hash(input: string): string {
  let value = 2_166_136_261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return (value >>> 0).toString(16).padStart(8, '0')
}

function byMagnitude(a: PerformanceAttribution, b: PerformanceAttribution): number {
  return Math.abs(b.valueChange) - Math.abs(a.valueChange)
}

function attribution(
  id: string,
  label: string,
  tickers: string[],
  startValue: number,
  endValue: number,
): PerformanceAttribution {
  const valueChange = endValue - startValue
  return {
    id,
    label,
    tickers: [...new Set(tickers)].sort(),
    startValue,
    endValue,
    valueChange,
    pctChange: pct(valueChange, startValue),
  }
}

function summaryKey(summary: Omit<PerformanceSummary, 'summaryKey'>): string {
  const stable = JSON.stringify({
    period: summary.period,
    start: summary.effectiveStartDate,
    end: summary.effectiveEndDate,
    valueChange: Math.round(summary.valueChange * 100),
    tickers: summary.tickerAttribution.map((item) => [item.id, Math.round(item.valueChange * 100)]),
    themes: summary.themeAttribution.map((item) => [item.id, Math.round(item.valueChange * 100)]),
  })
  return `performance-${hash(stable)}`
}

function finishSummary(summary: Omit<PerformanceSummary, 'summaryKey'>): PerformanceSummary {
  return { ...summary, summaryKey: summaryKey(summary) }
}

/**
 * Builds today's close-to-current move from Finnhub's verified quote deltas.
 * Returns undefined unless every holding has a usable price and day change;
 * a partial book must never masquerade as whole-portfolio performance.
 */
export function buildLiveDaySummary(
  holdings: Holding[],
  date: string,
): PerformanceSummary | undefined {
  if (
    holdings.length === 0 ||
    holdings.some(
      (holding) =>
        holding.lastPrice == null ||
        !Number.isFinite(holding.lastPrice) ||
        holding.dayChangeValue == null ||
        !Number.isFinite(holding.dayChangeValue),
    )
  ) {
    return undefined
  }

  const tickerAttribution = holdings
    .map((holding) => {
      const endValue = holding.shares * (holding.lastPrice as number)
      const valueChange = holding.shares * (holding.dayChangeValue as number)
      return attribution(
        `ticker:${holding.ticker.toUpperCase()}`,
        holding.ticker.toUpperCase(),
        [holding.ticker.toUpperCase()],
        endValue - valueChange,
        endValue,
      )
    })
    .sort(byMagnitude)

  const themes = new Map<string, { tickers: string[]; start: number; end: number }>()
  for (const holding of holdings) {
    const end = holding.shares * (holding.lastPrice as number)
    const start = end - holding.shares * (holding.dayChangeValue as number)
    for (const tag of holding.tags ?? []) {
      const key = tag.trim().toLowerCase()
      if (!key) continue
      const current = themes.get(key) ?? { tickers: [], start: 0, end: 0 }
      current.tickers.push(holding.ticker.toUpperCase())
      current.start += start
      current.end += end
      themes.set(key, current)
    }
  }
  const themeAttribution = [...themes.entries()]
    .map(([key, value]) => attribution(`theme:${key}`, titleCase(key), value.tickers, value.start, value.end))
    .sort(byMagnitude)

  const startValue = tickerAttribution.reduce((sum, item) => sum + item.startValue, 0)
  const endValue = tickerAttribution.reduce((sum, item) => sum + item.endValue, 0)
  const valueChange = endValue - startValue

  return finishSummary({
    period: 'day',
    requestedStartDate: date,
    requestedEndDate: date,
    effectiveStartDate: date,
    effectiveEndDate: date,
    startValue,
    endValue,
    valueChange,
    pctChange: pct(valueChange, startValue),
    direction: direction(valueChange),
    hasPositionChanges: false,
    overlappingThemes: themeAttribution.length > 0,
    holdingsCount: holdings.length,
    tickerAttribution,
    themeAttribution,
  })
}

/**
 * Compares the earliest and latest complete captures inside the requested
 * range. This is exact value change, not tax P&L or a cash-flow-adjusted
 * investment return. Share/ticker changes are detected and surfaced so the
 * UI can say when trading or contributions affected the result.
 */
export function buildSnapshotSummary(
  rows: PositionSnapshot[],
  requestedStartDate: string,
  requestedEndDate: string,
  period: Exclude<PerformancePeriod, 'day'>,
  currentTagsByTicker: ReadonlyMap<string, string[]> = new Map(),
): PerformanceSummary | undefined {
  const dates = [...new Set(rows.map((row) => row.snapshotDate))].sort()
  if (dates.length < 2) return undefined
  const effectiveStartDate = dates[0]
  const effectiveEndDate = dates.at(-1) as string
  const startRows = rows.filter((row) => row.snapshotDate === effectiveStartDate)
  const endRows = rows.filter((row) => row.snapshotDate === effectiveEndDate)
  if (startRows.length === 0 || endRows.length === 0) return undefined

  const startByTicker = new Map(startRows.map((row) => [row.ticker.toUpperCase(), row]))
  const endByTicker = new Map(endRows.map((row) => [row.ticker.toUpperCase(), row]))
  const tickers = [...new Set([...startByTicker.keys(), ...endByTicker.keys()])].sort()

  let hasPositionChanges = false
  const tickerAttribution = tickers
    .map((ticker) => {
      const start = startByTicker.get(ticker)
      const end = endByTicker.get(ticker)
      if (!start || !end || Math.abs(start.shares - end.shares) > 1e-9) hasPositionChanges = true
      return attribution(
        `ticker:${ticker}`,
        ticker,
        [ticker],
        start?.marketValue ?? 0,
        end?.marketValue ?? 0,
      )
    })
    .sort(byMagnitude)

  const themes = new Map<string, { tickers: string[]; start: number; end: number }>()
  for (const ticker of tickers) {
    const start = startByTicker.get(ticker)
    const end = endByTicker.get(ticker)
    const currentTags = currentTagsByTicker.get(ticker)
    const tags = currentTags ?? [...new Set([...(start?.tags ?? []), ...(end?.tags ?? [])])]
    for (const tag of tags) {
      const key = tag.trim().toLowerCase()
      if (!key) continue
      const current = themes.get(key) ?? { tickers: [], start: 0, end: 0 }
      current.tickers.push(ticker)
      current.start += start?.marketValue ?? 0
      current.end += end?.marketValue ?? 0
      themes.set(key, current)
    }
  }
  const themeAttribution = [...themes.entries()]
    .map(([key, value]) => attribution(`theme:${key}`, titleCase(key), value.tickers, value.start, value.end))
    .sort(byMagnitude)

  const startValue = startRows.reduce((sum, row) => sum + row.marketValue, 0)
  const endValue = endRows.reduce((sum, row) => sum + row.marketValue, 0)
  const valueChange = endValue - startValue

  return finishSummary({
    period,
    requestedStartDate,
    requestedEndDate,
    effectiveStartDate,
    effectiveEndDate,
    startValue,
    endValue,
    valueChange,
    pctChange: pct(valueChange, startValue),
    direction: direction(valueChange),
    hasPositionChanges,
    overlappingThemes: themeAttribution.length > 0,
    holdingsCount: endRows.length,
    tickerAttribution,
    themeAttribution,
  })
}

export function topAttribution(
  items: PerformanceAttribution[],
  limit = 3,
): PerformanceAttribution[] {
  return items.filter((item) => Math.abs(item.valueChange) >= 0.005).slice(0, limit)
}
