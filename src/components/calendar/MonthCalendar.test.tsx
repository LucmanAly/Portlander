import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, startOfMonth } from 'date-fns'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import type { ScoredEvent } from '@/types'

function scoredEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: overrides.id ?? 'ev-1',
    ticker: 'AAPL',
    title: 'Apple earnings',
    eventType: 'earnings',
    eventDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 10,
    impactScore: 50,
    impactBreakdown: { weightComponent: 5, typeComponent: 3, recencyComponent: 2 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 1000,
    ...overrides,
  }
}

const monthStartKey = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const monthStartLabel = format(startOfMonth(new Date()), 'EEEE, MMMM d')
// Anchored + comma-terminated so "August 1" can't match inside "August 15"/"August 10".
const monthStartNameRegex = new RegExp(`^${monthStartLabel},`)

describe('MonthCalendar', () => {
  it('renders day cells as non-interactive divs when onSelectDay is not provided (only nav buttons exist)', () => {
    render(<MonthCalendar events={[]} />)
    // Previous month / Today / Next month — 3 nav controls, no day-cell buttons.
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders each day as a focusable, labeled button when onSelectDay is provided', () => {
    render(<MonthCalendar events={[]} onSelectDay={() => {}} />)
    // 6-week grid = 42 day cells, all rendered as buttons (plus 3 nav buttons).
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(28 + 3)
  })

  it('calls onSelectDay with the clicked day key', async () => {
    const user = userEvent.setup()
    const onSelectDay = vi.fn()
    render(<MonthCalendar events={[]} onSelectDay={onSelectDay} />)
    await user.click(screen.getByRole('button', { name: monthStartNameRegex }))
    expect(onSelectDay).toHaveBeenCalledWith(monthStartKey)
  })

  it('marks the selected day pressed', () => {
    render(<MonthCalendar events={[]} selectedDate={monthStartKey} onSelectDay={() => {}} />)
    const cell = screen.getByRole('button', { name: monthStartNameRegex })
    expect(cell).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a cluster badge with the count when a day has 2+ events, not for 1', () => {
    const dateKey = monthStartKey
    const oneEvent = [scoredEvent({ id: 'a', eventDate: dateKey })]
    const twoEvents = [
      scoredEvent({ id: 'a', ticker: 'AAPL', eventDate: dateKey }),
      scoredEvent({ id: 'b', ticker: 'MSFT', eventDate: dateKey }),
    ]

    const { rerender } = render(<MonthCalendar events={oneEvent} />)
    expect(screen.queryByTitle('2 reports this day')).not.toBeInTheDocument()

    rerender(<MonthCalendar events={twoEvents} />)
    expect(screen.getByTitle('2 reports this day')).toBeInTheDocument()
  })

  it('labels empty days honestly', () => {
    render(<MonthCalendar events={[]} onSelectDay={() => {}} />)
    expect(
      screen.getByRole('button', { name: new RegExp(`^${monthStartLabel}, no events$`) }),
    ).toBeInTheDocument()
  })
})
