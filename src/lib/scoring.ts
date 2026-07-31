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

export function portfolioTotalValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + holdingMarketValue(h), 0)
}

/** Position weight 0–100. Override wins; else market value / total. */
export function positionWeightPct(holding: Holding, totalValue: number): number {
  if (holding.weightOverridePct != null && !Number.isNaN(holding.weightOverridePct)) {
    return Math.max(0, Math.min(100, holding.weightOverridePct))
  }
  if (totalValue <= 0) return 0
  return (holdingMarketValue(holding) / totalValue) * 100
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
  totalValue: number,
  today = startOfDay(new Date()),
): ScoredEvent {
  const ticker = event.ticker?.toUpperCase() ?? null
  const holding = ticker
    ? holdings.find((h) => h.ticker.toUpperCase() === ticker)
    : undefined
  const onWatch = ticker
    ? watchlist.some((w) => w.ticker.toUpperCase() === ticker)
    : false

  const weightPct = holding ? positionWeightPct(holding, totalValue) : 0
  // Normalize weight: 20% position → 1.0 on this component scale
  const weightNorm = Math.min(1, weightPct / 20)
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
  const total = portfolioTotalValue(holdings)
  const holdingTickers = new Set(holdings.map((h) => h.ticker.toUpperCase()))

  let scored = events
    .filter((e) => {
      const d = parseISO(e.eventDate)
      return d >= from && d <= to
    })
    .map((e) => scoreEvent(e, holdings, watchlist, total, today))

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

  return scored.sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore
    return a.eventDate.localeCompare(b.eventDate)
  })
}

export function computeExposure(
  events: PortfolioEvent[],
  holdings: Holding[],
  watchlist: WatchlistItem[],
  today = startOfDay(new Date()),
): ExposureSummary {
  const total = portfolioTotalValue(holdings)
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
        pct += positionWeightPct(h, total)
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
