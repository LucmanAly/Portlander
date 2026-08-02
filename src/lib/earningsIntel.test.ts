import { describe, expect, it } from 'vitest'
import {
  buildEarningsCardModel,
  buildEarningsCards,
  deriveEarningsViewState,
  earningsFactsFromRaw,
  earningsHistoryFromEvents,
  interpretationFromRaw,
} from '@/lib/earningsIntel'
import type { PortfolioEvent, ScoredEvent } from '@/types'

const TODAY = new Date(2026, 7, 2) // 2026-08-02

function scoredEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: 'ev-1',
    ticker: 'AAPL',
    title: 'Apple earnings',
    eventType: 'earnings',
    eventDate: '2026-08-02',
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 12.3,
    impactScore: 70,
    impactBreakdown: { weightComponent: 40, typeComponent: 20, recencyComponent: 10 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 10_000,
    ...overrides,
  }
}

describe('deriveEarningsViewState', () => {
  it('returns upcoming for a future date regardless of actual presence', () => {
    expect(deriveEarningsViewState('2026-08-05', false, TODAY)).toBe('upcoming')
    expect(deriveEarningsViewState('2026-08-05', true, TODAY)).toBe('upcoming')
  })

  it('returns awaiting for today/past without an actual', () => {
    expect(deriveEarningsViewState('2026-08-02', false, TODAY)).toBe('awaiting')
    expect(deriveEarningsViewState('2026-07-30', false, TODAY)).toBe('awaiting')
  })

  it('returns reported for today/past with an actual', () => {
    expect(deriveEarningsViewState('2026-08-02', true, TODAY)).toBe('reported')
    expect(deriveEarningsViewState('2026-07-30', true, TODAY)).toBe('reported')
  })
})

describe('buildEarningsCardModel', () => {
  it('degrades cleanly with no facts at all', () => {
    const model = buildEarningsCardModel(scoredEvent({ eventDate: '2026-08-05' }), undefined, undefined, TODAY)
    expect(model.facts).toBeUndefined()
    expect(model.interpretation).toBeUndefined()
    expect(model.viewState).toBe('upcoming')
  })

  it('derives reported when facts include an actual', () => {
    const model = buildEarningsCardModel(
      scoredEvent({ eventDate: '2026-07-30' }),
      { actual: { epsActual: 1.5 } },
      undefined,
      TODAY,
    )
    expect(model.viewState).toBe('reported')
  })

  it('derives awaiting when facts have consensus but no actual, date has passed', () => {
    const model = buildEarningsCardModel(
      scoredEvent({ eventDate: '2026-07-30' }),
      { consensus: { epsEstimate: 1.2 } },
      undefined,
      TODAY,
    )
    expect(model.viewState).toBe('awaiting')
  })

  it('carries ticker/weight/marketValue/impactScore straight from the ScoredEvent', () => {
    const model = buildEarningsCardModel(
      scoredEvent({ ticker: 'MSFT', positionWeightPct: 24.3, marketValue: 14_875, impactScore: 91 }),
      undefined,
      undefined,
      TODAY,
    )
    expect(model.ticker).toBe('MSFT')
    expect(model.positionWeightPct).toBe(24.3)
    expect(model.marketValue).toBe(14_875)
    expect(model.impactScore).toBe(91)
  })

  it('keeps interpretation as a sibling of facts, not nested inside it', () => {
    const model = buildEarningsCardModel(
      scoredEvent({ eventDate: '2026-07-30' }),
      { actual: { epsActual: 1.5 } },
      { summary: 'Beat expectations' },
      TODAY,
    )
    expect(model.interpretation?.summary).toBe('Beat expectations')
    expect('interpretation' in (model.facts ?? {})).toBe(false)
  })
})

describe('earningsFactsFromRaw', () => {
  it('returns undefined when there is no raw payload', () => {
    expect(earningsFactsFromRaw(undefined)).toBeUndefined()
    expect(earningsFactsFromRaw(null)).toBeUndefined()
    expect(earningsFactsFromRaw('not an object')).toBeUndefined()
  })

  it('reads consensus/actual as real numbers from the stored Finnhub row', () => {
    const facts = earningsFactsFromRaw({
      epsEstimate: 1.5,
      epsActual: 1.64,
      revenueEstimate: 94_500_000_000,
      revenueActual: 96_200_000_000,
    })
    expect(facts?.consensus).toEqual({ epsEstimate: 1.5, revenueEstimate: 94_500_000_000 })
    expect(facts?.actual).toEqual({ epsActual: 1.64, revenueActual: 96_200_000_000 })
  })

  it('computes surprise pct/abs from consensus vs actual', () => {
    const facts = earningsFactsFromRaw({ epsEstimate: 1.5, epsActual: 1.64 })
    expect(facts?.surprise?.epsSurprisePct).toBeCloseTo(9.333, 2)
    expect(facts?.surprise?.epsSurpriseAbs).toBeCloseTo(0.14, 5)
    expect(facts?.surprise?.revenueSurprisePct).toBeUndefined()
  })

  it('omits surprise entirely when there is no consensus to diff against', () => {
    const facts = earningsFactsFromRaw({ epsActual: 2.1 })
    expect(facts?.actual?.epsActual).toBe(2.1)
    expect(facts?.surprise).toBeUndefined()
  })

  it('never fabricates guidance or reaction — Finnhub has neither', () => {
    const facts = earningsFactsFromRaw({ epsEstimate: 1, epsActual: 1.1 })
    expect(facts?.guidance).toBeUndefined()
    expect(facts?.reaction).toBeUndefined()
  })

  it('does not divide by zero when the consensus estimate is 0', () => {
    const facts = earningsFactsFromRaw({ epsEstimate: 0, epsActual: 0.1 })
    expect(facts?.surprise?.epsSurprisePct).toBeUndefined()
  })

  it('ignores non-finite/malformed provider fields rather than throwing', () => {
    const facts = earningsFactsFromRaw({ epsEstimate: 'n/a', epsActual: NaN, revenueEstimate: 500 })
    expect(facts?.consensus).toEqual({ epsEstimate: undefined, revenueEstimate: 500 })
    expect(facts?.actual).toBeUndefined()
  })

  it('capitalizes the event source for display and threads fetchedAt through', () => {
    const facts = earningsFactsFromRaw({ epsEstimate: 1 }, 'finnhub', '2026-08-01T12:00:00Z')
    expect(facts?.provenance).toEqual({ source: 'Finnhub', fetchedAt: '2026-08-01T12:00:00Z' })
  })
})

describe('earningsHistoryFromEvents', () => {
  function pastEvent(ticker: string, eventDate: string, raw?: Record<string, unknown>): PortfolioEvent {
    return {
      id: `ev-${ticker}-${eventDate}`,
      ticker,
      title: `${ticker} earnings`,
      eventType: 'earnings',
      eventDate,
      timing: 'amc',
      status: 'confirmed',
      source: 'finnhub',
      raw,
    }
  }

  it('returns quarters strictly before the given date, newest first', () => {
    const events = [
      pastEvent('AAPL', '2026-05-01', { epsEstimate: 1, epsActual: 1.1, quarter: 2, year: 2026 }),
      pastEvent('AAPL', '2026-02-01', { epsEstimate: 1, epsActual: 0.9, quarter: 1, year: 2026 }),
      pastEvent('AAPL', '2026-08-02', { epsEstimate: 1, epsActual: 1.2, quarter: 3, year: 2026 }), // same day as beforeDate, excluded
    ]
    const history = earningsHistoryFromEvents('AAPL', '2026-08-02', events)
    expect(history.map((h) => h.quarter)).toEqual(['Q2 2026', 'Q1 2026'])
  })

  it('ignores other tickers and non-earnings event types', () => {
    const events = [
      pastEvent('TSLA', '2026-05-01', { epsEstimate: 1, epsActual: 1.1 }),
      { ...pastEvent('AAPL', '2026-05-01', { epsEstimate: 1, epsActual: 1.1 }), eventType: 'ex_div' as const },
    ]
    expect(earningsHistoryFromEvents('AAPL', '2026-08-02', events)).toEqual([])
  })

  it('skips events with no raw payload — demo/fixture rows never contribute real history', () => {
    const events = [pastEvent('AAPL', '2026-05-01')]
    expect(earningsHistoryFromEvents('AAPL', '2026-08-02', events)).toEqual([])
  })

  it('marks a quarter unknown (null/null), not a miss, when actuals are missing', () => {
    const events = [pastEvent('AAPL', '2026-05-01', { epsEstimate: 1, quarter: 2, year: 2026 })]
    const [entry] = earningsHistoryFromEvents('AAPL', '2026-08-02', events)
    expect(entry).toEqual({ quarter: 'Q2 2026', epsBeat: null, revenueBeat: null })
  })

  it('caps at the requested limit', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      pastEvent('AAPL', `2026-0${i + 1}-01`, { epsEstimate: 1, epsActual: 1.1, quarter: i + 1, year: 2025 }),
    )
    expect(earningsHistoryFromEvents('AAPL', '2026-08-02', events, 4)).toHaveLength(4)
  })

  it('falls back to the event date as the quarter label when quarter/year are absent', () => {
    const events = [pastEvent('AAPL', '2026-05-01', { epsEstimate: 1, epsActual: 1.1 })]
    const [entry] = earningsHistoryFromEvents('AAPL', '2026-08-02', events)
    expect(entry.quarter).toBe('2026-05-01')
  })
})

describe('interpretationFromRaw', () => {
  it('returns undefined for absent/non-object values', () => {
    expect(interpretationFromRaw(undefined)).toBeUndefined()
    expect(interpretationFromRaw(null)).toBeUndefined()
    expect(interpretationFromRaw('a summary string')).toBeUndefined()
  })

  it('accepts a valid interpretation and strips unknown fields', () => {
    expect(
      interpretationFromRaw({
        summary: 'Beat on both lines.',
        model: 'deepseek-v4-flash',
        generatedAt: '2026-08-01T12:00:00Z',
        confidence: 'medium',
        somethingElse: 'ignored',
      }),
    ).toEqual({
      summary: 'Beat on both lines.',
      model: 'deepseek-v4-flash',
      generatedAt: '2026-08-01T12:00:00Z',
      confidence: 'medium',
    })
  })

  it('rejects a missing or empty summary', () => {
    expect(interpretationFromRaw({ model: 'deepseek-v4-flash' })).toBeUndefined()
    expect(interpretationFromRaw({ summary: '   ' })).toBeUndefined()
  })

  it('rejects an oversized summary rather than truncating it silently', () => {
    expect(interpretationFromRaw({ summary: 'x'.repeat(601) })).toBeUndefined()
  })

  it('drops an invalid confidence value instead of rejecting the whole interpretation', () => {
    const result = interpretationFromRaw({ summary: 'Beat on both lines.', confidence: 'extremely certain' })
    expect(result?.summary).toBe('Beat on both lines.')
    expect(result?.confidence).toBeUndefined()
  })
})

describe('buildEarningsCards', () => {
  function rawEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
    return scoredEvent({
      id: 'ev-real-aapl',
      ticker: 'AAPL',
      eventDate: '2026-07-30',
      source: 'finnhub',
      raw: { epsEstimate: 2, epsActual: 2.2, revenueEstimate: 1000, revenueActual: 900 },
      updatedAt: '2026-08-01T00:00:00Z',
      ...overrides,
    })
  }

  it('builds facts from raw, real numbers only', () => {
    const [card] = buildEarningsCards([rawEvent()], new Date(2026, 7, 2))
    expect(card.facts?.consensus?.epsEstimate).toBe(2)
    expect(card.facts?.actual?.epsActual).toBe(2.2)
    expect(card.facts?.provenance?.source).toBe('Finnhub')
  })

  it('has no interpretation when the event has no stored ai_interpretation', () => {
    const [card] = buildEarningsCards([rawEvent()], new Date(2026, 7, 2))
    expect(card.interpretation).toBeUndefined()
  })

  it('reads and validates a real stored ai_interpretation (BE-06)', () => {
    const [card] = buildEarningsCards(
      [rawEvent({ interpretation: { summary: 'Beat on both lines.', model: 'deepseek-v4-flash', confidence: 'high' } })],
      new Date(2026, 7, 2),
    )
    expect(card.interpretation).toEqual({
      summary: 'Beat on both lines.',
      model: 'deepseek-v4-flash',
      generatedAt: undefined,
      confidence: 'high',
    })
  })

  it('discards a malformed stored ai_interpretation rather than rendering it', () => {
    const [card] = buildEarningsCards(
      [rawEvent({ interpretation: { confidence: 'high' } })], // no summary
      new Date(2026, 7, 2),
    )
    expect(card.interpretation).toBeUndefined()
  })

  it('renders an honest facts: undefined for a real ticker with no raw payload, even one that collides with a demo fixture ticker (BE-05)', () => {
    const [card] = buildEarningsCards(
      [scoredEvent({ id: 'ev-real-no-raw', ticker: 'AAPL', eventDate: '2026-07-30' })],
      new Date(2026, 7, 2),
    )
    expect(card.facts).toBeUndefined()
    expect(card.interpretation).toBeUndefined()
  })

  it('attaches real history from sibling events in the same array (BE-04)', () => {
    const priorQuarter = scoredEvent({
      id: 'ev-aapl-prior',
      ticker: 'AAPL',
      eventDate: '2026-05-01',
      raw: { epsEstimate: 1, epsActual: 0.9, quarter: 2, year: 2026 },
    })
    const cards = buildEarningsCards([priorQuarter, rawEvent()], new Date(2026, 7, 2))
    const card = cards.find((c) => c.id === 'ev-real-aapl')
    expect(card?.facts?.history).toEqual([{ quarter: 'Q2 2026', epsBeat: false, revenueBeat: null }])
  })

  it('uses historyEvents, not the display-window events, when the two differ', () => {
    const priorQuarter = scoredEvent({
      id: 'ev-aapl-prior',
      ticker: 'AAPL',
      eventDate: '2026-05-01',
      raw: { epsEstimate: 1, epsActual: 1.1, quarter: 2, year: 2026 },
    })
    // Only the current-quarter event is in the display window; history comes
    // from the wider historyEvents array (mirrors Today's deck calling
    // convention — see todayDeck.ts).
    const [card] = buildEarningsCards([rawEvent()], new Date(2026, 7, 2), [priorQuarter, rawEvent()])
    expect(card.facts?.history).toEqual([{ quarter: 'Q2 2026', epsBeat: true, revenueBeat: null }])
  })
})
