import {
  addDays,
  differenceInCalendarDays,
  parseISO,
  startOfDay,
} from 'date-fns'
import type {
  EventFilter,
  EventType,
  ExposureSummary,
  Holding,
  PortfolioEvent,
  ScoredEvent,
  WatchlistItem,
} from '@/types'

const TYPE_WEIGHT: Record<EventType, number> = {
  earnings: 1.0,
  ex_div: 0.35,
  pay_div: 0.25,
  fomc: 0.55,
  cpi: 0.55,
  nfp: 0.5,
  other_macro: 0.45,
}

export function isMacroType(t: EventType): boolean {
  return t === 'fomc' || t === 'cpi' || t === 'nfp' || t === 'other_macro'
}

export function isDividendType(t: EventType): boolean {
  return t === 'ex_div' || t === 'pay_div'
}

export function holdingMarketValue(h: Holding): number {
  const price = h.lastPrice ?? h.costBasis ?? 0
  return h.shares * price
}

/** True when market value fell back to cost basis — an estimate, not an observed price. */
export function isEstimatedValue(h: Holding): boolean {
  return h.lastPrice == null && h.costBasis != null
}

export function portfolioTotalValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + holdingMarketValue(h), 0)
}

function clampOverride(pct: number): number {
  return Math.max(0, Math.min(100, pct))
}

function hasOverride(h: Holding): boolean {
  return h.weightOverridePct != null && !Number.isNaN(h.weightOverridePct)
}

/**
 * Denominator for `positionWeightPct`'s computed branch. A plain
 * `portfolioTotalValue()` still includes overridden holdings' market value in
 * the total, so an override adds its fixed percentage *on top of* what the
 * computed holdings already summed to — a book mixing overrides and computed
 * weights doesn't sum to 100%. This scales the computed holdings' shared
 * denominator down so their weights fill exactly the remainder the overrides
 * leave behind. With no overrides in the book, this is `portfolioTotalValue()`.
 */
export function portfolioWeightBasis(holdings: Holding[]): number {
  const overrideSum = holdings.reduce(
    (sum, h) => sum + (hasOverride(h) ? clampOverride(h.weightOverridePct as number) : 0),
    0,
  )
  const computedValue = holdings.reduce(
    (sum, h) => sum + (hasOverride(h) ? 0 : holdingMarketValue(h)),
    0,
  )
  const remainingPct = Math.max(0, 100 - overrideSum)
  if (remainingPct <= 0 || computedValue <= 0) return 0
  return (computedValue * 100) / remainingPct
}

/** Position weight 0–100. Override wins; else market value / basis. Pass `portfolioWeightBasis(holdings)`, not the raw dollar total, so a mixed book sums to 100%. */
export function positionWeightPct(holding: Holding, weightBasis: number): number {
  if (hasOverride(holding)) {
    return clampOverride(holding.weightOverridePct as number)
  }
  if (weightBasis <= 0) return 0
  return (holdingMarketValue(holding) / weightBasis) * 100
}

function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0
  const rank = Math.ceil((p / 100) * sortedAscending.length) - 1
  return sortedAscending[Math.min(sortedAscending.length - 1, Math.max(0, rank))]
}

/**
 * Portfolio-relative anchor for `weightNorm`, replacing the old fixed `/20`
 * clamp. That clamp meant every position at or above 20% weight scored
 * identically — on a realistically flat book (max weight ~13.5%), almost the
 * whole book landed in one narrow band and only the single largest position
 * could ever reach the red tier. `max(5, p90 * 1.5)` keeps a sane floor on a
 * very concentrated book while staying relative to how spread out *this*
 * book actually is.
 */
export function weightAnchor(holdings: Holding[], weightBasis: number): number {
  const weights = holdings.map((h) => positionWeightPct(h, weightBasis)).sort((a, b) => a - b)
  return Math.max(5, percentile(weights, 90) * 1.5)
}

export type ScoreTier = 'high' | 'medium' | 'low'

export function scoreTier(impactScore: number): ScoreTier {
  if (impactScore >= 70) return 'high'
  if (impactScore >= 45) return 'medium'
  return 'low'
}

/** Today's dollar gain/loss for the position, from the last "Refresh prices" run. */
export function holdingDayChange(h: Holding): number | undefined {
  if (h.dayChangeValue == null) return undefined
  return h.shares * h.dayChangeValue
}

/** True when every position has an observed price and day-change value from the same refresh. */
function hasObservedDayChange(h: Holding): boolean {
  return (
    h.lastPrice != null &&
    Number.isFinite(h.lastPrice) &&
    h.dayChangeValue != null &&
    Number.isFinite(h.dayChangeValue)
  )
}

/**
 * Today's dollar move for the whole book. A partial refresh is deliberately
 * reported as unavailable rather than presenting a misleading partial total.
 */
export function portfolioDayChange(holdings: Holding[]): number | undefined {
  if (holdings.length === 0 || !holdings.every(hasObservedDayChange)) return undefined
  return holdings.reduce((sum, h) => sum + (holdingDayChange(h) ?? 0), 0)
}

/**
 * Today's portfolio move as a percentage of the previous close. Both values
 * require a complete price refresh so the denominator is the prior portfolio
 * value, not today's value.
 */
export function portfolioDayChangePct(holdings: Holding[]): number | undefined {
  const change = portfolioDayChange(holdings)
  if (change == null) return undefined

  const currentValue = holdings.reduce((sum, h) => sum + h.shares * (h.lastPrice as number), 0)
  const previousValue = currentValue - change
  if (!Number.isFinite(previousValue) || previousValue <= 0) return undefined

  return (change / previousValue) * 100
}

/** Total unrealized gain/loss ($) since cost basis. Undefined if either input is missing. */
export function holdingTotalGainLoss(h: Holding): number | undefined {
  if (h.lastPrice == null || h.costBasis == null) return undefined
  return (h.lastPrice - h.costBasis) * h.shares
}

/** Total unrealized gain/loss (%) since cost basis. Undefined if either input is missing/zero. */
export function holdingTotalGainLossPct(h: Holding): number | undefined {
  if (h.lastPrice == null || h.costBasis == null || h.costBasis === 0) return undefined
  return ((h.lastPrice - h.costBasis) / h.costBasis) * 100
}

function recencyBoost(eventDate: string, today = startOfDay(new Date())): number {
  const days = differenceInCalendarDays(parseISO(eventDate), today)
  if (days < 0) return 0
  if (days === 0) return 1
  if (days <= 3) return 0.9
  if (days <= 7) return 0.75
  if (days <= 14) return 0.55
  if (days <= 30) return 0.35
  return 0.15
}

/**
 * Impact score v0 (0–100):
 * 65% position weight + 25% event type + 10% recency
 */
export function scoreEvent(
  event: PortfolioEvent,
  holdings: Holding[],
  watchlist: WatchlistItem[],
  weightBasis: number,
  today = startOfDay(new Date()),
): ScoredEvent {
  const ticker = event.ticker?.toUpperCase() ?? null
  const holding = ticker
    ? holdings.find((h) => h.ticker.toUpperCase() === ticker)
    : undefined
  const onWatch = ticker
    ? watchlist.some((w) => w.ticker.toUpperCase() === ticker)
    : false

  const weightPct = holding ? positionWeightPct(holding, weightBasis) : 0
  const anchor = weightAnchor(holdings, weightBasis)
  const weightNorm = anchor > 0 ? Math.min(1, weightPct / anchor) : 0
  const typeW = TYPE_WEIGHT[event.eventType] ?? 0.4
  const recency = recencyBoost(event.eventDate, today)

  const weightComponent = 0.65 * weightNorm
  const typeComponent = 0.25 * typeW
  const recencyComponent = 0.1 * recency
  const impactScore = Math.round((weightComponent + typeComponent + recencyComponent) * 100)

  return {
    ...event,
    positionWeightPct: weightPct,
    impactScore,
    impactBreakdown: {
      weightComponent: Math.round(weightComponent * 100),
      typeComponent: Math.round(typeComponent * 100),
      recencyComponent: Math.round(recencyComponent * 100),
    },
    isHolding: Boolean(holding),
    isWatchlist: onWatch && !holding,
    marketValue: holding ? holdingMarketValue(holding) : 0,
  }
}

export function scoreAndFilterEvents(
  events: PortfolioEvent[],
  holdings: Holding[],
  watchlist: WatchlistItem[],
  opts: {
    filter?: EventFilter
    fromDate?: Date
    toDate?: Date
    today?: Date
  } = {},
): ScoredEvent[] {
  const today = startOfDay(opts.today ?? new Date())
  const from = opts.fromDate ?? today
  const to = opts.toDate ?? addDays(today, 14)
  const weightBasis = portfolioWeightBasis(holdings)
  const holdingTickers = new Set(holdings.map((h) => h.ticker.toUpperCase()))

  let scored = events
    .filter((e) => {
      const d = parseISO(e.eventDate)
      return d >= from && d <= to
    })
    .map((e) => scoreEvent(e, holdings, watchlist, weightBasis, today))

  const filter = opts.filter ?? 'all'
  if (filter === 'earnings') {
    scored = scored.filter((e) => e.eventType === 'earnings')
  } else if (filter === 'dividends') {
    scored = scored.filter((e) => isDividendType(e.eventType))
  } else if (filter === 'macro') {
    scored = scored.filter((e) => isMacroType(e.eventType))
  } else if (filter === 'holdings') {
    scored = scored.filter(
      (e) => e.isHolding || (e.ticker && holdingTickers.has(e.ticker.toUpperCase())),
    )
  }

  return sortEventsByImpact(scored)
}

export function sortEventsByImpact<T extends { eventDate: string; impactScore: number }>(
  events: T[],
): T[] {
  return [...events].sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore
    return a.eventDate.localeCompare(b.eventDate)
  })
}

/** Chronological, nearest first; ties broken by impact so the more material event leads. */
export function sortEventsByDate<T extends { eventDate: string; impactScore: number }>(
  events: T[],
): T[] {
  return [...events].sort((a, b) => {
    if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate)
    return b.impactScore - a.impactScore
  })
}

export function computeExposure(
  events: PortfolioEvent[],
  holdings: Holding[],
  watchlist: WatchlistItem[],
  today = startOfDay(new Date()),
): ExposureSummary {
  const total = portfolioTotalValue(holdings)
  const weightBasis = portfolioWeightBasis(holdings)
  const end7 = addDays(today, 7)
  const end30 = addDays(today, 30)

  const earningsInWindow = (end: Date) => {
    const tickers = new Set<string>()
    for (const e of events) {
      if (e.eventType !== 'earnings' || !e.ticker) continue
      const d = parseISO(e.eventDate)
      if (d >= today && d <= end) tickers.add(e.ticker.toUpperCase())
    }
    let pct = 0
    for (const h of holdings) {
      if (tickers.has(h.ticker.toUpperCase())) {
        pct += positionWeightPct(h, weightBasis)
      }
    }
    return Math.min(100, Math.round(pct * 10) / 10)
  }

  const upcoming = scoreAndFilterEvents(events, holdings, watchlist, {
    fromDate: today,
    toDate: end30,
    today,
  })
  const nextCritical =
    upcoming.find((e) => e.isHolding && e.eventType === 'earnings') ??
    upcoming.find((e) => e.isHolding) ??
    upcoming[0] ??
    null

  return {
    earnings7dPct: earningsInWindow(end7),
    earnings30dPct: earningsInWindow(end30),
    nextCritical,
    totalPortfolioValue: total,
    holdingsCount: holdings.length,
  }
}

export function eventTypeLabel(t: EventType): string {
  const map: Record<EventType, string> = {
    earnings: 'Earnings',
    ex_div: 'Ex-dividend',
    pay_div: 'Dividend pay',
    fomc: 'FOMC',
    cpi: 'CPI',
    nfp: 'NFP / Jobs',
    other_macro: 'Macro',
  }
  return map[t] ?? t
}

export function timingLabel(t: PortfolioEvent['timing']): string {
  if (t === 'bmo') return 'BMO'
  if (t === 'amc') return 'AMC'
  return '—'
}
