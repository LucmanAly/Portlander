import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NeedsAttention, needsAttentionEvents } from '@/components/today/NeedsAttention'
import type { ScoredEvent } from '@/types'

function renderNeedsAttention(events: ScoredEvent[]) {
  return render(
    <MemoryRouter>
      <NeedsAttention events={events} />
    </MemoryRouter>,
  )
}

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
    const { container } = renderNeedsAttention([])
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each event with ticker, title, and weight', () => {
    renderNeedsAttention([scoredEvent({ ticker: 'MSFT', title: 'Microsoft earnings' })])
    expect(screen.getByText(/MSFT · Microsoft earnings/)).toBeInTheDocument()
    expect(screen.getByText('10.0%')).toBeInTheDocument()
  })

  it('links earnings rows to the earnings workspace, deep-linked by ticker', () => {
    renderNeedsAttention([scoredEvent({ ticker: 'MSFT', eventType: 'earnings' })])
    expect(screen.getByRole('link')).toHaveAttribute('href', '/earnings?ticker=MSFT')
  })

  it('links non-earnings rows to the calendar day', () => {
    renderNeedsAttention([
      scoredEvent({ ticker: null, title: 'Fed rate decision', eventType: 'fomc', eventDate: '2026-08-10' }),
    ])
    expect(screen.getByRole('link')).toHaveAttribute('href', '/calendar?date=2026-08-10')
  })
})
