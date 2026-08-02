import { describe, expect, it } from 'vitest'
import { selectDeckCards } from '@/lib/todayDeck'
import type { ScoredEvent } from '@/types'

const TODAY = new Date(2026, 7, 2) // 2026-08-02

function scoredEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: overrides.id ?? 'ev-1',
    ticker: 'AAPL',
    title: 'Apple earnings',
    eventType: 'earnings',
    eventDate: '2026-08-02',
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 10,
    impactScore: 50,
    impactBreakdown: { weightComponent: 30, typeComponent: 15, recencyComponent: 5 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 5000,
    ...overrides,
  }
}

describe('selectDeckCards', () => {
  it('includes D-1, D0, and D+1', () => {
    const events = [
      scoredEvent({ id: 'd-1', ticker: 'A', eventDate: '2026-08-01' }),
      scoredEvent({ id: 'd0', ticker: 'B', eventDate: '2026-08-02' }),
      scoredEvent({ id: 'd+1', ticker: 'C', eventDate: '2026-08-03' }),
    ]
    const cards = selectDeckCards(events, TODAY)
    expect(cards.map((c) => c.id).sort()).toEqual(['d+1', 'd-1', 'd0'])
  })

  it('excludes D-2 and D+2', () => {
    const events = [
      scoredEvent({ id: 'd-2', ticker: 'A', eventDate: '2026-07-31' }),
      scoredEvent({ id: 'd+2', ticker: 'B', eventDate: '2026-08-04' }),
    ]
    expect(selectDeckCards(events, TODAY)).toHaveLength(0)
  })

  it('excludes non-earnings event types even inside the window', () => {
    const events = [scoredEvent({ id: 'macro', eventType: 'fomc', eventDate: '2026-08-02' })]
    expect(selectDeckCards(events, TODAY)).toHaveLength(0)
  })

  it('excludes events with no ticker (pure macro rows)', () => {
    const events = [scoredEvent({ id: 'no-ticker', ticker: null, eventDate: '2026-08-02' })]
    expect(selectDeckCards(events, TODAY)).toHaveLength(0)
  })

  it('sorts by impact descending', () => {
    const events = [
      scoredEvent({ id: 'low', ticker: 'A', eventDate: '2026-08-02', impactScore: 20 }),
      scoredEvent({ id: 'high', ticker: 'B', eventDate: '2026-08-02', impactScore: 90 }),
    ]
    const cards = selectDeckCards(events, TODAY)
    expect(cards.map((c) => c.id)).toEqual(['high', 'low'])
  })

  it('returns an empty array when nothing is in the window', () => {
    expect(selectDeckCards([], TODAY)).toEqual([])
  })
})
