import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SelectedDayDetail } from '@/components/calendar/SelectedDayDetail'
import type { ScoredEvent } from '@/types'

function scoredEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: 'ev-1',
    ticker: 'AAPL',
    title: 'Apple earnings',
    eventType: 'earnings',
    eventDate: '2026-08-04',
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 24.3,
    impactScore: 91,
    impactBreakdown: { weightComponent: 5, typeComponent: 3, recencyComponent: 2 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 14_875,
    ...overrides,
  }
}

describe('SelectedDayDetail', () => {
  it('shows a prompt when no day is selected', () => {
    render(<SelectedDayDetail dateKey={null} events={[]} />)
    expect(screen.getByText(/select a day on the calendar/i)).toBeInTheDocument()
  })

  it('shows an honest empty state for a selected day with no events', () => {
    render(<SelectedDayDetail dateKey="2026-08-04" events={[]} />)
    expect(screen.getByText('No events this day.')).toBeInTheDocument()
  })

  it('lists events with ticker, title, impact score, and weight for holdings', () => {
    render(<SelectedDayDetail dateKey="2026-08-04" events={[scoredEvent()]} />)
    expect(screen.getByText(/AAPL · Apple earnings/)).toBeInTheDocument()
    expect(screen.getByText('91')).toBeInTheDocument()
    expect(screen.getByText('24.3%')).toBeInTheDocument()
  })

  it('omits the weight line for a non-holding event', () => {
    render(<SelectedDayDetail dateKey="2026-08-04" events={[scoredEvent({ isHolding: false, positionWeightPct: 0 })]} />)
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
  })
})
