import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format, startOfDay, startOfMonth } from 'date-fns'
import { CalendarPage } from '@/pages/CalendarPage'
import { renderWithPortfolio } from '@/test/testProviders'
import { formatFullDate } from '@/lib/format'
import type { PortfolioEvent } from '@/types'

function makeEvent(overrides: Partial<PortfolioEvent> & { id: string; eventDate: string }): PortfolioEvent {
  return {
    ticker: 'AAPL',
    title: 'Apple earnings',
    eventType: 'earnings',
    timing: 'amc',
    status: 'confirmed',
    source: 'test',
    ...overrides,
  }
}

describe('CalendarPage', () => {
  it('shows the selection prompt before any day is picked', () => {
    renderWithPortfolio(<CalendarPage />, { overrides: { events: [], holdings: [], watchlist: [] } })
    expect(screen.getByText(/select a day on the calendar/i)).toBeInTheDocument()
  })

  it('selecting a day with an event populates the detail panel', async () => {
    const user = userEvent.setup()
    const dateKey = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const events: PortfolioEvent[] = [
      {
        id: 'ev-1',
        ticker: 'AAPL',
        title: 'Apple earnings',
        eventType: 'earnings',
        eventDate: dateKey,
        timing: 'amc',
        status: 'confirmed',
        source: 'test',
      },
    ]
    renderWithPortfolio(<CalendarPage />, { overrides: { events, holdings: [], watchlist: [] } })

    const monthStartLabel = format(startOfMonth(new Date()), 'EEEE, MMMM d')
    await user.click(screen.getByRole('button', { name: new RegExp(`^${monthStartLabel},`) }))

    expect(screen.getByText(/AAPL · Apple earnings/)).toBeInTheDocument()
  })

  it('auto-selects today by default when today has something reporting', () => {
    const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const events = [makeEvent({ id: 'ev-today', ticker: 'MSFT', eventDate: todayKey })]
    renderWithPortfolio(<CalendarPage />, { overrides: { events, holdings: [], watchlist: [] } })
    // Matches both the (CSS-hidden-on-mobile-but-still-mounted) day-detail panel and the
    // agenda row for the same event — either is proof the day got auto-selected.
    expect(screen.getAllByText(/MSFT · Apple earnings/).length).toBeGreaterThan(0)
  })

  it('auto-selects the next upcoming event when today has nothing', () => {
    const nextWeek = format(addDays(startOfDay(new Date()), 7), 'yyyy-MM-dd')
    const events = [
      makeEvent({ id: 'ev-past', ticker: 'OLD', eventDate: format(addDays(new Date(), -10), 'yyyy-MM-dd') }),
      makeEvent({ id: 'ev-next', ticker: 'NVDA', eventDate: nextWeek }),
    ]
    renderWithPortfolio(<CalendarPage />, { overrides: { events, holdings: [], watchlist: [] } })
    expect(screen.queryByText(/select a day on the calendar/i)).not.toBeInTheDocument()
    expect(screen.queryAllByText(/OLD · Apple earnings/)).toHaveLength(0)
    expect(screen.getAllByText(/NVDA · Apple earnings/).length).toBeGreaterThan(0)
  })

  it('deep-linked ?date= wins over the today/next-event default', () => {
    const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const linkedDate = format(addDays(new Date(), 3), 'yyyy-MM-dd')
    const events = [
      makeEvent({ id: 'ev-today', ticker: 'TODAY', eventDate: todayKey }),
      makeEvent({ id: 'ev-linked', ticker: 'LINKED', eventDate: linkedDate }),
    ]
    renderWithPortfolio(<CalendarPage />, {
      overrides: { events, holdings: [], watchlist: [] },
      initialEntries: [`/calendar?date=${linkedDate}`],
    })
    // Detail panel specifically (not just "somewhere on the page", which the agenda
    // list would also satisfy for TODAY) is what proves the deep link, not the default.
    const detailHeading = screen.getByText(formatFullDate(linkedDate))
    const detailPanel = detailHeading.closest('div') as HTMLElement
    expect(within(detailPanel).getByText(/LINKED · Apple earnings/)).toBeInTheDocument()
    expect(within(detailPanel).queryByText(/TODAY · Apple earnings/)).not.toBeInTheDocument()
  })

  it('mobile view defaults to Agenda and switches to Month on tap', async () => {
    const user = userEvent.setup()
    renderWithPortfolio(<CalendarPage />, { overrides: { events: [], holdings: [], watchlist: [] } })
    const toggle = screen.getByRole('button', { name: 'Agenda' }).parentElement as HTMLElement
    expect(within(toggle).getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(toggle).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(within(toggle).getByRole('button', { name: 'Month' }))
    expect(within(toggle).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
  })
})
