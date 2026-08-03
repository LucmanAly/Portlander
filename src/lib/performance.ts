import { format, parseISO, subDays, startOfWeek } from 'date-fns'
import type { Holding } from '@/types'
import type {
  PerformanceContributor,
  PerformanceSnapshot,
  PerformanceSnapshotRun,
  PerformanceSummary,
} from '@/types/performance'

const TAG_LABELS: Record<string, string> = {
  ai: 'AI',
  'ai-infra': 'AI infrastructure',
  cyber: 'Cybersecurity',
  cybersecurity: 'Cybersecurity',
  crypto: 'Crypto',
  quantum: 'Quantum computing',
  infra: 'Infrastructure',
  core: 'Core holdings',
  'fallen-angel': 'Turnaround holdings',
  untagged: 'Untagged holdings',
}

type ContributionRow = {
  date: string
  ticker: string
  pnl: number
  openingValue: number
  closingValue: number
  tags: string[]
}

export function preferredPerformanceWindow(now = new Date()): {
  startDate: string
  endDate: string
  kind: 'day' | 'week'
} {
  const date = newYorkMarketDate(now)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).format(now)
  if (weekday !== 'Sat' && weekday !== 'Sun') {
    return { startDate: date, endDate: date, kind: 'day' }
  }

  const friday = subDays(parseISO(date), weekday === 'Sat' ? 1 : 2)
  return {
    startDate: format(startOfWeek(friday, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(friday, 'yyyy-MM-dd'),
    kind: 'week',
  }
}

export function newYorkMarketDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function liveDailyPerformance(
  holdings: Holding[],
  snapshotDate = format(new Date(), 'yyyy-MM-dd'),
): PerformanceSummary {
  const observed = holdings.filter(
    (holding) =>
      holding.lastPrice != null &&
      Number.isFinite(holding.lastPrice) &&
      holding.dayChangeValue != null &&
      Number.isFinite(holding.dayChangeValue),
  )

  const rows: ContributionRow[] = observed.map((holding) => {
    const price = holding.lastPrice as number
    const change = holding.dayChangeValue as number
    return {
      date: snapshotDate,
      ticker: holding.ticker.toUpperCase(),
      pnl: holding.shares * change,
      openingValue: holding.shares * (price - change),
      closingValue: holding.shares * price,
      tags: normalizeTags(holding.tags),
    }
  })

  const complete = holdings.length > 0 && observed.length === holdings.length
  return summaryFromRows(rows, {
    startDate: snapshotDate,
    endDate: snapshotDate,
    basis: 'live-quote',
    coverage: rows.length === 0 ? 'unavailable' : complete ? 'complete' : 'partial',
    expectedPositions: holdings.length,
    coveredPositions: observed.length,
    limitations: complete
      ? ['Intraday trades are valued using the shares present at the time of the quote refresh.']
      : ['The total is withheld because one or more holdings are missing a current price or day change.'],
  })
}

export function snapshotPerformance(
  snapshots: PerformanceSnapshot[],
  runs: PerformanceSnapshotRun[],
  startDate: string,
  endDate: string,
): PerformanceSummary {
  const completeDates = new Set(
    runs
      .filter((run) => run.status === 'ok' && run.snapshotDate >= startDate && run.snapshotDate <= endDate)
      .map((run) => run.snapshotDate),
  )
  const rows: ContributionRow[] = snapshots
    .filter(
      (snapshot) =>
        snapshot.snapshotDate >= startDate &&
        snapshot.snapshotDate <= endDate &&
        completeDates.has(snapshot.snapshotDate),
    )
    .map((snapshot) => ({
      date: snapshot.snapshotDate,
      ticker: snapshot.ticker.toUpperCase(),
      pnl: snapshot.shares * snapshot.dayChangeValue,
      openingValue: snapshot.shares * snapshot.previousClose,
      closingValue: snapshot.marketValue,
      tags: normalizeTags(snapshot.tags),
    }))

  const coveredDates = [...new Set(rows.map((row) => row.date))].sort()
  const latestRun = [...runs]
    .filter((run) => completeDates.has(run.snapshotDate))
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0]
  const rangeStartsWithCoverage = coveredDates[0] === startDate
  const coverage =
    rows.length === 0 ? 'unavailable' : rangeStartsWithCoverage ? 'complete' : 'partial'

  return summaryFromRows(rows, {
    startDate,
    endDate,
    basis: 'daily-snapshots',
    coverage,
    expectedPositions: latestRun?.expectedPositions ?? 0,
    coveredPositions: latestRun?.capturedPositions ?? 0,
    limitations: [
      ...(rangeStartsWithCoverage
        ? []
        : ['Snapshot history does not cover the beginning of the selected range.']),
      'Dollar P&L sums market movement from each captured day; deposits, withdrawals, and intraday trades are not treated as investment gains.',
      'Theme tags may overlap, so theme dollar changes are not designed to add up to the portfolio total.',
    ],
  })
}

function summaryFromRows(
  rows: ContributionRow[],
  options: Omit<
    PerformanceSummary,
    | 'coveredDates'
    | 'totalPnlValue'
    | 'totalReturnPct'
    | 'openingValue'
    | 'closingValue'
    | 'themes'
    | 'holdings'
    | 'evidenceHash'
  >,
): PerformanceSummary {
  const coveredDates = [...new Set(rows.map((row) => row.date))].sort()
  const dailyRows = new Map<string, ContributionRow[]>()
  for (const row of rows) {
    dailyRows.set(row.date, [...(dailyRows.get(row.date) ?? []), row])
  }

  const totalPnl = rows.reduce((sum, row) => sum + row.pnl, 0)
  const openingValue = rows
    .filter((row) => row.date === coveredDates[0])
    .reduce((sum, row) => sum + row.openingValue, 0)
  const closingValue = rows
    .filter((row) => row.date === coveredDates.at(-1))
    .reduce((sum, row) => sum + row.closingValue, 0)
  const totalReturnPct = compoundReturn([...dailyRows.values()])
  const totalsAvailable = options.coverage === 'complete' && rows.length > 0

  const themes = aggregateContributors(rows, (row) => row.tags)
  const holdings = aggregateContributors(rows, (row) => [row.ticker])
  const evidence = {
    startDate: options.startDate,
    endDate: options.endDate,
    coveredDates,
    totalPnl: totalsAvailable ? round(totalPnl) : null,
    totalReturnPct: totalsAvailable ? round(totalReturnPct) : null,
    themes: themes.map(({ key, pnlValue, returnPct }) => ({
      key,
      pnlValue: round(pnlValue),
      returnPct: returnPct == null ? null : round(returnPct),
    })),
    holdings: holdings.slice(0, 5).map(({ key, pnlValue }) => ({ key, pnlValue: round(pnlValue) })),
  }

  return {
    ...options,
    coveredDates,
    totalPnlValue: totalsAvailable ? totalPnl : undefined,
    totalReturnPct: totalsAvailable ? totalReturnPct : undefined,
    openingValue: rows.length ? openingValue : undefined,
    closingValue: rows.length ? closingValue : undefined,
    themes,
    holdings,
    evidenceHash: hashEvidence(JSON.stringify(evidence)),
  }
}

function aggregateContributors(
  rows: ContributionRow[],
  keysFor: (row: ContributionRow) => string[],
): PerformanceContributor[] {
  const byKey = new Map<string, ContributionRow[]>()
  for (const row of rows) {
    for (const key of keysFor(row)) {
      byKey.set(key, [...(byKey.get(key) ?? []), row])
    }
  }

  return [...byKey.entries()]
    .map(([key, group]) => {
      const byDate = new Map<string, ContributionRow[]>()
      for (const row of group) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row])
      return {
        key,
        label: TAG_LABELS[key] ?? titleCase(key),
        pnlValue: group.reduce((sum, row) => sum + row.pnl, 0),
        returnPct: compoundReturn([...byDate.values()]),
        openingValue: group
          .filter((row) => row.date === [...byDate.keys()].sort()[0])
          .reduce((sum, row) => sum + row.openingValue, 0),
        closingValue: group
          .filter((row) => row.date === [...byDate.keys()].sort().at(-1))
          .reduce((sum, row) => sum + row.closingValue, 0),
        tickers: [...new Set(group.map((row) => row.ticker))].sort(),
      }
    })
    .sort((a, b) => Math.abs(b.pnlValue) - Math.abs(a.pnlValue))
}

function compoundReturn(days: ContributionRow[][]): number {
  if (days.length === 0) return 0
  let growth = 1
  for (const rows of days) {
    const opening = rows.reduce((sum, row) => sum + row.openingValue, 0)
    if (opening <= 0) continue
    growth *= 1 + rows.reduce((sum, row) => sum + row.pnl, 0) / opening
  }
  return (growth - 1) * 100
}

function normalizeTags(tags: string[] | undefined): string[] {
  const normalized = [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
  return normalized.length ? normalized : ['untagged']
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function hashEvidence(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
