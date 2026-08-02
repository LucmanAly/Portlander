import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format, subDays } from 'date-fns'
import { EarningsPage } from '@/pages/EarningsPage'
import { renderWithPortfolio } from '@/test/testProviders'
import type { Holding, PortfolioEvent } from '@/types'

const today = new Date()
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function earningsEvent(ticker: string, eventDate: Date): PortfolioEvent {
  return {
    id: `ev-${ticker}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate: iso(eventDate),
    timing: 'amc',
    status: 'confirmed',
    source: 'fixture',
  }
}

// Tickers chosen to match src/data/earningsFixtures.ts entries so viewState
// derives from real facts: AAPL/META have `actual`, NVDA/RIVN don't.
const EVENTS: PortfolioEvent[] = [
  earningsEvent('RIVN', addDays(today, 10)), // upcoming (no consensus actual)
  earningsEvent('NVDA', today), // awaiting (no actual yet)
  earningsEvent('AAPL', subDays(today, 3)), // reported, within 7 days
  earningsEvent('META', subDays(today, 10)), // reported, older than 7 days but within the 14-day lookback
]

const HOLDINGS: Holding[] = [
  {
    id: 'h1',
    ticker: 'AAPL',
    shares: 10,
    lastPrice: 200,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function renderPage() {
  return renderWithPortfolio(<EarningsPage />, {
    overrides: { events: EVENTS, holdings: HOLDINGS, watchlist: [] },
    initialEntries: ['/earnings'],
  })
}

describe('EarningsPage', () => {
  it('shows the Portfolio empty state when there are no holdings', () => {
    renderWithPortfolio(<EarningsPage />, { overrides: { events: EVENTS, holdings: [], watchlist: [] } })
    expect(screen.getByText(/add holdings to populate earnings/i)).toBeInTheDocument()
  })

  it('lists all 4 reports under the All filter', () => {
    renderPage()
    expect(screen.getByText('RIVN')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('META')).toBeInTheDocument()
  })

  it('groups cards under a date/session heading', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 2, name: /After Close/ }).length).toBeGreaterThan(0)
  })

  it('filters to Active (awaiting) only', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.queryByText('RIVN')).not.toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
  })

  it('filters to Upcoming only', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Upcoming' }))
    expect(screen.getByText('RIVN')).toBeInTheDocument()
    expect(screen.queryByText('NVDA')).not.toBeInTheDocument()
  })

  it('filters to Recently reported, excluding the older report', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Recently reported' }))
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('META')).not.toBeInTheDocument()
  })

  it('shows an honest empty state when a filter matches nothing', async () => {
    const user = userEvent.setup()
    renderWithPortfolio(<EarningsPage />, {
      overrides: { events: [earningsEvent('RIVN', addDays(today, 10))], holdings: HOLDINGS, watchlist: [] },
    })
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText(/no reports match this filter/i)).toBeInTheDocument()
  })

  it('reuses ForwardExposurePanel', () => {
    renderPage()
    expect(screen.getByText('Earnings · 7 days')).toBeInTheDocument()
  })

  it('selecting a card marks it pressed and opens the detail drawer', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByRole('button', { name: /AAPL/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(card)

    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('dialog', { name: /aapl earnings/i })).toBeInTheDocument()
  })

  it('closing the drawer clears the selection', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /AAPL/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AAPL/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles the sort control between Impact and Date without losing any cards', async () => {
    const user = userEvent.setup()
    renderPage()
    const dateButton = screen.getByRole('button', { name: 'Date' })
    expect(dateButton).toHaveAttribute('aria-pressed', 'false')
    await user.click(dateButton)
    expect(dateButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('RIVN')).toBeInTheDocument()
    expect(screen.getByText('META')).toBeInTheDocument()
  })
})
