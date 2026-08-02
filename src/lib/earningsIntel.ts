import { startOfDay } from 'date-fns'
import type { ScoredEvent } from '@/types'
import type { EarningsCardModel, EarningsFacts, EarningsViewState, GeneratedInterpretation } from '@/types/earnings'
import { sortEventsByImpact } from '@/lib/scoring'
import { EARNINGS_FIXTURES } from '@/data/earningsFixtures'

function numOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function surprisePct(actual?: number, estimate?: number): number | undefined {
  if (actual == null || estimate == null || estimate === 0) return undefined
  return ((actual - estimate) / Math.abs(estimate)) * 100
}

function surpriseAbs(actual?: number, estimate?: number): number | undefined {
  if (actual == null || estimate == null) return undefined
  return actual - estimate
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

/**
 * Builds EarningsFacts from a real event's stored provider payload
 * (`PortfolioEvent.raw` — Finnhub's earnings-calendar row, stored verbatim by
 * `sync-events`'s `toEventRow()`). Returns undefined when there's no raw
 * payload to read (macro rows, fixture-only synthetic events), so callers can
 * fall back to demo fixtures honestly instead of rendering an empty-but-real
 * card (BE-01).
 *
 * Surprise is computed here at read time from consensus/actual, not written
 * by `sync-events` (BE-02) — one computation point, no duplicate formula.
 *
 * Deliberately never sets `guidance`/`reaction`: Finnhub's
 * `/calendar/earnings` endpoint returns neither field, and inventing them
 * would violate the app's honest-undefined rule. Leaving them absent here is
 * the correct behavior until a provider for them is wired (BE-03) — the UI
 * already renders their absence as nothing, not a placeholder.
 */
export function earningsFactsFromRaw(
  raw: unknown,
  source?: string,
  fetchedAt?: string,
): EarningsFacts | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>

  const epsEstimate = numOrUndefined(r.epsEstimate)
  const epsActual = numOrUndefined(r.epsActual)
  const revenueEstimate = numOrUndefined(r.revenueEstimate)
  const revenueActual = numOrUndefined(r.revenueActual)

  const hasConsensus = epsEstimate != null || revenueEstimate != null
  const hasActual = epsActual != null || revenueActual != null

  const epsSurprisePct = surprisePct(epsActual, epsEstimate)
  const revenueSurprisePct = surprisePct(revenueActual, revenueEstimate)
  const hasSurprise = epsSurprisePct != null || revenueSurprisePct != null

  return {
    consensus: hasConsensus ? { epsEstimate, revenueEstimate } : undefined,
    actual: hasActual ? { epsActual, revenueActual } : undefined,
    surprise: hasSurprise
      ? {
          epsSurprisePct,
          epsSurpriseAbs: surpriseAbs(epsActual, epsEstimate),
          revenueSurprisePct,
          revenueSurpriseAbs: surpriseAbs(revenueActual, revenueEstimate),
        }
      : undefined,
    provenance: { source: source ? capitalize(source) : 'Finnhub', fetchedAt },
  }
}

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
 * Filters to ticker-bearing earnings events, sorts by impact, and attaches
 * facts: real numbers from the event's stored Finnhub payload when present
 * (BE-01/02), else the demo fixture for that ticker. Shared by Today's deck
 * (after its own D-1..D+1 window filter) and the Earnings workspace (no
 * window filter beyond its own query range) so both build cards the same way.
 */
export function buildEarningsCards(events: ScoredEvent[], today: Date = new Date()): EarningsCardModel[] {
  const earningsOnly = events.filter((e) => e.eventType === 'earnings' && e.ticker)
  return sortEventsByImpact(earningsOnly).map((e) => {
    const realFacts = earningsFactsFromRaw(e.raw, e.source, e.updatedAt)
    const fixture = EARNINGS_FIXTURES[e.ticker as string]
    const facts = realFacts ?? fixture
    // Interpretation stays fixture-only: a DeepSeek summary written against
    // demo numbers must never get attached to a real event's facts (BE-06
    // hasn't wired interpretation to real EarningsFacts yet).
    const interpretation = realFacts ? undefined : fixture?.interpretation
    return buildEarningsCardModel(e, facts, interpretation, today)
  })
}
