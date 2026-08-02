import { describe, expect, it } from 'vitest'
import { buildEarningsCardModel, buildEarningsCards, deriveEarningsViewState, earningsFactsFromRaw } from '@/lib/earningsIntel'
import type { ScoredEvent } from '@/types'

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

  it('prefers real facts derived from raw over the AAPL demo fixture', () => {
    const [card] = buildEarningsCards([rawEvent()], new Date(2026, 7, 2))
    expect(card.facts?.consensus?.epsEstimate).toBe(2)
    expect(card.facts?.actual?.epsActual).toBe(2.2)
    expect(card.facts?.provenance?.source).toBe('Finnhub')
  })

  it('drops the fixture interpretation when real facts are used, to avoid mismatched generated prose', () => {
    const [card] = buildEarningsCards([rawEvent()], new Date(2026, 7, 2))
    expect(card.interpretation).toBeUndefined()
  })

  it('falls back to the fixture (facts + interpretation) when there is no raw payload', () => {
    const [card] = buildEarningsCards(
      [scoredEvent({ id: 'ev-fixture-aapl', ticker: 'AAPL', eventDate: '2026-07-30' })],
      new Date(2026, 7, 2),
    )
    expect(card.facts?.consensus?.epsEstimate).toBe(1.5)
    expect(card.interpretation?.summary).toContain('Beat on both lines')
  })
})
