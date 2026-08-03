import { startOfDay } from 'date-fns'
import type { PortfolioEvent, ScoredEvent } from '@/types'
import type {
  EarningsCardModel,
  EarningsFacts,
  EarningsViewState,
  GeneratedInterpretation,
  HistoricalBeat,
} from '@/types/earnings'
import { sortEventsByImpact } from '@/lib/scoring'

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

function quarterLabel(raw: unknown, eventDate: string): string {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    const quarter = numOrUndefined(r.quarter)
    const year = numOrUndefined(r.year)
    if (quarter != null && year != null) return `Q${quarter} ${year}`
  }
  return eventDate
}

function beatFromRaw(
  raw: unknown,
  actualKey: 'epsActual' | 'revenueActual',
  estimateKey: 'epsEstimate' | 'revenueEstimate',
): boolean | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const actual = numOrUndefined(r[actualKey])
  const estimate = numOrUndefined(r[estimateKey])
  if (actual == null || estimate == null) return null
  return actual >= estimate
}

/**
 * Last `limit` confirmed quarters' actual-vs-consensus for one ticker, newest
 * first, read from other real events already present in `events` — no new
 * provider call needed since `sync-events`'s widened lookback (BE-04) means
 * these rows already exist once synced. Only events with a raw payload count
 * (demo/fixture-only rows never contribute real history); a past event whose
 * sync hasn't landed an actual yet correctly renders as an unknown quarter
 * (`epsBeat`/`revenueBeat`: null), not a miss.
 */
export function earningsHistoryFromEvents(
  ticker: string,
  beforeDate: string,
  events: PortfolioEvent[],
  limit = 4,
): HistoricalBeat[] {
  return events
    .filter((e) => e.eventType === 'earnings' && e.ticker === ticker && e.eventDate < beforeDate && e.raw)
    .sort((a, b) => (a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : 0))
    .slice(0, limit)
    .map((e) => ({
      quarter: quarterLabel(e.raw, e.eventDate),
      epsBeat: beatFromRaw(e.raw, 'epsActual', 'epsEstimate'),
      revenueBeat: beatFromRaw(e.raw, 'revenueActual', 'revenueEstimate'),
    }))
}

function withHistory(facts: EarningsFacts | undefined, history: HistoricalBeat[]): EarningsFacts | undefined {
  if (history.length === 0) return facts
  return { ...facts, history }
}

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high'])

/**
 * Strictly validates a stored `events.ai_interpretation` payload into a
 * `GeneratedInterpretation` before it ever reaches the UI (BE-06). Re-checks
 * the shape on every read rather than trusting the write path's own
 * validation (the `earnings-interpret` Edge Function already validates
 * before writing) — defense in depth for a field an external model
 * produced. Any missing/malformed/oversized summary returns undefined;
 * `GeneratedInsight` already renders nothing when interpretation is absent,
 * so this fails safe by construction, same as every other optional fact.
 */
export function interpretationFromRaw(value: unknown): GeneratedInterpretation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const r = value as Record<string, unknown>
  if (typeof r.summary !== 'string') return undefined
  const summary = r.summary.trim()
  if (summary.length === 0 || summary.length > 600) return undefined

  const confidence =
    typeof r.confidence === 'string' && CONFIDENCE_VALUES.has(r.confidence)
      ? (r.confidence as GeneratedInterpretation['confidence'])
      : undefined

  return {
    summary,
    model: typeof r.model === 'string' ? r.model : undefined,
    generatedAt: typeof r.generatedAt === 'string' ? r.generatedAt : undefined,
    confidence,
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

/**
 * True when there's at least one real EPS/revenue number (estimate or, once
 * reported, actual) to show. Cards/drawers use this to hide the whole
 * financials block rather than rendering two rows of "—" + "no estimate
 * available" — repeated across every sparse card, that reads as broken
 * rather than honest.
 */
export function hasFinancialData(facts: EarningsFacts | undefined, isReported: boolean): boolean {
  if (!facts) return false
  if (facts.consensus?.epsEstimate != null || facts.consensus?.revenueEstimate != null) return true
  if (isReported && (facts.actual?.epsActual != null || facts.actual?.revenueActual != null)) return true
  return false
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
 * facts derived only from each event's own stored provider payload
 * (BE-01/02/04) — never a ticker-matched demo fixture (BE-05: a real AAPL or
 * META holding must not get decorated with demo Apple/Meta numbers just
 * because the ticker happens to collide with one of the 8 fixture states
 * `src/data/earningsFixtures.ts` exists for — those are unit-test fixtures
 * only now, read directly by the component tests that need all 8 states,
 * not by this production path). A card with no raw payload renders an
 * honest `facts: undefined`, same as any other missing-data state.
 *
 * `historyEvents` defaults to `events` but should be passed the full,
 * unwindowed portfolio events array when the caller (Today's deck) has
 * already narrowed `events` to a display window — BE-04 history needs to see
 * quarters outside that window to find anything.
 *
 * `interpretation` reads and re-validates each event's own stored
 * `ai_interpretation` (BE-06) — never a fixture's, and never generated here;
 * it's `undefined` for every event until the owner configures DeepSeek
 * secrets and runs the `earnings-interpret` Edge Function for that event.
 *
 * Shared by Today's deck (after its own D-1..D+1 window filter) and the
 * Earnings workspace (no window filter beyond its own query range) so both
 * build cards the same way.
 */
export function buildEarningsCards(
  events: ScoredEvent[],
  today: Date = new Date(),
  historyEvents: PortfolioEvent[] = events,
): EarningsCardModel[] {
  const earningsOnly = events.filter((e) => e.eventType === 'earnings' && e.ticker)
  return sortEventsByImpact(earningsOnly).map((e) => {
    const facts = earningsFactsFromRaw(e.raw, e.source, e.updatedAt)
    const history = earningsHistoryFromEvents(e.ticker as string, e.eventDate, historyEvents)
    const interpretation = interpretationFromRaw(e.interpretation)
    return buildEarningsCardModel(e, withHistory(facts, history), interpretation, today)
  })
}
