import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortfolioTable } from '@/components/portfolio/PortfolioTable'
import type { Holding } from '@/types'

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h1',
    ticker: 'AAPL',
    shares: 10,
    lastPrice: 200,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('PortfolioTable', () => {
  it('shows an honest empty message when there are no holdings', () => {
    render(<PortfolioTable holdings={[]} weightBasis={0} onRemove={() => {}} emptyMessage="No holdings yet." />)
    expect(screen.getAllByText('No holdings yet.').length).toBeGreaterThan(0)
  })

  it('exposes per-row provenance and freshness via a tooltip on the source badge, not an extra column', () => {
    render(
      <PortfolioTable
        holdings={[holding({ source: 'snaptrade', updatedAt: '2026-07-15T00:00:00.000Z' })]}
        weightBasis={2000}
        onRemove={() => {}}
      />,
    )
    const badges = screen.getAllByText('Synced')
    expect(badges[0]).toHaveAttribute('title', expect.stringContaining('Synced from brokerage'))
    expect(badges[0]).toHaveAttribute('title', expect.stringContaining('Jul 15'))
  })

  it('renders the desktop header row in sentence case, not all-caps', () => {
    render(<PortfolioTable holdings={[holding()]} weightBasis={2000} onRemove={() => {}} />)
    const header = screen.getByText('Ticker')
    expect(header.closest('tr')).toHaveClass('text-ink-450')
    expect(header.closest('tr')).not.toHaveClass('uppercase')
  })

  it('shows an honest "No price yet" instead of a fabricated $0.00 for a fully unpriced position', () => {
    render(
      <PortfolioTable
        holdings={[holding({ lastPrice: undefined, costBasis: undefined })]}
        weightBasis={0}
        onRemove={() => {}}
      />,
    )
    expect(screen.getAllByText('No price yet').length).toBeGreaterThan(0)
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })

  it('still shows a real value (not "No price yet") when a price or cost basis exists', () => {
    render(<PortfolioTable holdings={[holding({ lastPrice: 200 })]} weightBasis={2000} onRemove={() => {}} />)
    expect(screen.queryByText('No price yet')).not.toBeInTheDocument()
  })
})
