import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, startOfMonth } from 'date-fns'
import { CalendarPage } from '@/pages/CalendarPage'
import { renderWithPortfolio } from '@/test/testProviders'
import type { PortfolioEvent } from '@/types'

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
})
