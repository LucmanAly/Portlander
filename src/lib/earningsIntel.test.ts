import { describe, expect, it } from 'vitest'
import { buildEarningsCardModel, deriveEarningsViewState } from '@/lib/earningsIntel'
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
