import { startOfDay } from 'date-fns'
import type { ScoredEvent } from '@/types'
import type { EarningsCardModel, EarningsFacts, EarningsViewState, GeneratedInterpretation } from '@/types/earnings'
import { sortEventsByImpact } from '@/lib/scoring'
import { EARNINGS_FIXTURES } from '@/data/earningsFixtures'

/**
 * Future event date → `upcoming`. Today-or-past without an `actual` yet →
 * `awaiting` (covers real-world reporting lag between the calendar date and
 * the actual release). Today-or-past with an `actual` present → `reported`.
 */
export function deriveEarningsViewState(
  eventDate: string,
  hasActual: boolean,
  today: Date = new Date(),
): EarningsViewState {
  const eventDay = startOfDay(new Date(`${eventDate}T00:00:00`))
  const todayDay = startOfDay(today)

  if (eventDay.getTime() > todayDay.getTime()) return 'upcoming'
  return hasActual ? 'reported' : 'awaiting'
}

/** Builds an EarningsCardModel from a real ScoredEvent plus optional fixture facts. Never throws on missing facts. */
export function buildEarningsCardModel(
  event: ScoredEvent,
  facts?: EarningsFacts,
  interpretation?: GeneratedInterpretation,
  today: Date = new Date(),
): EarningsCardModel {
  const hasActual =
    facts?.actual?.epsActual != null || facts?.actual?.revenueActual != null

  return {
    id: event.id,
    ticker: event.ticker ?? '',
    title: event.title,
    eventDate: event.eventDate,
    eventTime: event.eventTime,
    timing: event.timing,
    viewState: deriveEarningsViewState(event.eventDate, hasActual, today),
    isHolding: event.isHolding,
    isWatchlist: event.isWatchlist,
    positionWeightPct: event.positionWeightPct,
    marketValue: event.marketValue,
    impactScore: event.impactScore,
    facts,
    interpretation,
  }
}

/**
 * Filters to ticker-bearing earnings events, sorts by impact, and looks up
 * fixture facts by ticker. Shared by Today's deck (after its own D-1..D+1
 * window filter) and the Earnings workspace (no window filter beyond its
 * own query range) so both build cards the same way.
 */
export function buildEarningsCards(events: ScoredEvent[], today: Date = new Date()): EarningsCardModel[] {
  const earningsOnly = events.filter((e) => e.eventType === 'earnings' && e.ticker)
  return sortEventsByImpact(earningsOnly).map((e) => {
    const fixture = EARNINGS_FIXTURES[e.ticker as string]
    return buildEarningsCardModel(e, fixture, fixture?.interpretation, today)
  })
}
