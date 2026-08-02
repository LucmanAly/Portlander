import { describe, expect, it } from 'vitest'
import { groupEarningsCards } from '@/lib/earningsGrouping'
import { buildEarningsCardModel } from '@/lib/earningsIntel'
import type { ScoredEvent } from '@/types'

function card(ticker: string, eventDate: string, timing: 'bmo' | 'amc' | 'unknown', impactScore = 50) {
  const event: ScoredEvent = {
    id: `ev-${ticker}-${eventDate}-${timing}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate,
    timing,
    status: 'confirmed',
    positionWeightPct: 5,
    impactScore,
    impactBreakdown: { weightComponent: 3, typeComponent: 1, recencyComponent: 1 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 1000,
  }
  return buildEarningsCardModel(event, undefined, undefined, new Date(2026, 7, 2))
}

describe('groupEarningsCards', () => {
  it('groups by eventDate + timing', () => {
    const groups = groupEarningsCards([
      card('AAPL', '2026-08-04', 'amc'),
      card('MSFT', '2026-08-04', 'amc'),
      card('GOOGL', '2026-08-04', 'bmo'),
    ])
    expect(groups).toHaveLength(2)
    const amcGroup = groups.find((g) => g.heading.includes('After Close'))
    expect(amcGroup?.cards.map((c) => c.ticker).sort()).toEqual(['AAPL', 'MSFT'])
  })

  it('produces a readable heading combining the day and session', () => {
    const groups = groupEarningsCards([card('AAPL', '2026-08-04', 'bmo')])
    expect(groups[0].heading).toContain('Before Open')
  })

  it('sorts groups chronologically by key', () => {
    const groups = groupEarningsCards([
      card('LATE', '2026-08-10', 'amc'),
      card('EARLY', '2026-08-01', 'amc'),
    ])
    expect(groups.map((g) => g.cards[0].ticker)).toEqual(['EARLY', 'LATE'])
  })

  it('returns an empty array for no cards', () => {
    expect(groupEarningsCards([])).toEqual([])
  })
})
