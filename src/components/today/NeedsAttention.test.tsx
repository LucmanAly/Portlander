import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NeedsAttention, needsAttentionEvents } from '@/components/today/NeedsAttention'
import type { ScoredEvent } from '@/types'

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
    impactScore: 80,
    impactBreakdown: { weightComponent: 30, typeComponent: 15, recencyComponent: 5 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 5000,
    ...overrides,
  }
}

describe('needsAttentionEvents', () => {
  it('keeps only high-tier holdings', () => {
    const events = [
      scoredEvent({ id: 'high-holding', impactScore: 80, isHolding: true }),
      scoredEvent({ id: 'high-not-holding', impactScore: 80, isHolding: false }),
      scoredEvent({ id: 'medium-holding', impactScore: 50, isHolding: true }),
    ]
    expect(needsAttentionEvents(events).map((e) => e.id)).toEqual(['high-holding'])
  })

  it('caps at 5 and sorts by impact descending', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      scoredEvent({ id: `e${i}`, impactScore: 70 + i, isHolding: true }),
    )
    const result = needsAttentionEvents(events)
    expect(result).toHaveLength(5)
    expect(result.map((e) => e.impactScore)).toEqual([77, 76, 75, 74, 73])
  })
})

describe('NeedsAttention', () => {
  it('renders nothing when there are no events', () => {
    const { container } = render(<NeedsAttention events={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each event with ticker, title, and weight', () => {
    render(<NeedsAttention events={[scoredEvent({ ticker: 'MSFT', title: 'Microsoft earnings' })]} />)
    expect(screen.getByText(/MSFT · Microsoft earnings/)).toBeInTheDocument()
    expect(screen.getByText('10.0%')).toBeInTheDocument()
  })
})
