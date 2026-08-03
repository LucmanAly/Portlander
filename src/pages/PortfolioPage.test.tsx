import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { renderWithPortfolio } from '@/test/testProviders'
import type { Holding } from '@/types'

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: overrides.id ?? 'h1',
    ticker: 'AAPL',
    shares: 10,
    lastPrice: 200,
    costBasis: 150,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('PortfolioPage total gain/loss', () => {
  it('shows a real total when every position has price and cost basis', () => {
    renderWithPortfolio(<PortfolioPage />, { overrides: { holdings: [holding()] } })
    // "Total gain/loss" also labels the table column, so assert on the summary
    // tile's value specifically rather than the (non-unique) label text.
    expect(screen.getAllByText('Total gain/loss').length).toBeGreaterThan(0)
    // (200 - 150) * 10 = +$500
    expect(screen.getByText('+$500.00')).toBeInTheDocument()
  })

  it('shows an honest dash, not a partial total, when one position is missing cost basis', () => {
    renderWithPortfolio(<PortfolioPage />, {
      overrides: {
        holdings: [holding({ id: 'h1' }), holding({ id: 'h2', ticker: 'MSFT', costBasis: undefined })],
      },
    })
    expect(screen.getByText('Add cost basis to every position to calculate')).toBeInTheDocument()
  })
})

describe('PortfolioPage action feedback', () => {
  it('toasts after adding a holding', async () => {
    const user = userEvent.setup()
    renderWithPortfolio(<PortfolioPage />, { overrides: { holdings: [] } })
    await user.type(screen.getByLabelText('Ticker'), 'nvda')
    await user.type(screen.getByLabelText('Shares'), '5')
    await user.click(screen.getByRole('button', { name: /add \/ update/i }))
    expect(await screen.findByText('Added NVDA to holdings.')).toBeInTheDocument()
  })

  it('toasts after removing a watchlist ticker', async () => {
    const user = userEvent.setup()
    renderWithPortfolio(<PortfolioPage />, {
      overrides: {
        watchlist: [{ id: 'w1', ticker: 'TSLA', createdAt: '2026-01-01T00:00:00.000Z' }],
      },
    })
    await user.click(screen.getByRole('button', { name: 'Remove TSLA' }))
    expect(await screen.findByText('Removed TSLA from watchlist.')).toBeInTheDocument()
  })
})
