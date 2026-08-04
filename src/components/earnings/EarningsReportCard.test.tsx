import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EarningsReportCard } from '@/components/earnings/EarningsReportCard'
import { buildEarningsCardModel } from '@/lib/earningsIntel'
import { EARNINGS_FIXTURES, EARNINGS_FIXTURE_EVENTS, FIXTURE_TODAY } from '@/data/earningsFixtures'
import type { ScoredEvent } from '@/types'

// isHolding/isWatchlist varied across all 8 fixtures: holding-only, holding+watchlist,
// watchlist-only, and neither are all represented.
const MEMBERSHIP: Record<string, { isHolding: boolean; isWatchlist: boolean }> = {
  AAPL: { isHolding: true, isWatchlist: false },
  TSLA: { isHolding: true, isWatchlist: true },
  NVDA: { isHolding: true, isWatchlist: false },
  RIVN: { isHolding: false, isWatchlist: true },
  ARM: { isHolding: false, isWatchlist: false },
  GOOGL: { isHolding: true, isWatchlist: false },
  META: { isHolding: false, isWatchlist: true },
  AMZN: { isHolding: true, isWatchlist: false },
}

function modelFor(ticker: string) {
  const baseEvent = EARNINGS_FIXTURE_EVENTS.find((e) => e.ticker === ticker)
  if (!baseEvent) throw new Error(`no fixture event for ${ticker}`)
  const membership = MEMBERSHIP[ticker]

  const scored: ScoredEvent = {
    ...baseEvent,
    positionWeightPct: membership.isHolding ? 12.5 : 0,
    impactScore: 55,
    impactBreakdown: { weightComponent: 30, typeComponent: 20, recencyComponent: 5 },
    isHolding: membership.isHolding,
    isWatchlist: membership.isWatchlist,
    marketValue: membership.isHolding ? 9_000 : 0,
  }

  const facts = EARNINGS_FIXTURES[ticker]
  return buildEarningsCardModel(scored, facts, facts.interpretation, FIXTURE_TODAY)
}

describe('EarningsReportCard', () => {
  it.each(Object.keys(EARNINGS_FIXTURES))('renders %s without crashing and shows its ticker', (ticker) => {
    render(<EarningsReportCard card={modelFor(ticker)} />)
    expect(screen.getByText(ticker)).toBeInTheDocument()
  })

  it('shows the weight hero only for holdings', () => {
    const first = render(<EarningsReportCard card={modelFor('AAPL')} />)
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    first.unmount()

    render(<EarningsReportCard card={modelFor('ARM')} />)
    expect(screen.queryByText('Portfolio')).not.toBeInTheDocument()
  })

  it('shows a Watchlist chip only when isWatchlist is true', () => {
    render(<EarningsReportCard card={modelFor('RIVN')} />)
    expect(screen.getByText('Watchlist')).toBeInTheDocument()
  })

  it('shows actual-vs-estimate metrics only for reported cards, not upcoming/awaiting', () => {
    render(<EarningsReportCard card={modelFor('AAPL')} />) // reported
    expect(screen.getByText('$1.64')).toBeInTheDocument()

    const { unmount } = render(<EarningsReportCard card={modelFor('NVDA')} />) // awaiting, consensus only
    expect(screen.queryByText('$0.98')).not.toBeInTheDocument()
    unmount()
  })

  it('omits surprise/guidance/reaction sections entirely pre-release rather than rendering them empty', () => {
    render(<EarningsReportCard card={modelFor('RIVN')} />) // upcoming
    expect(screen.queryByText(/surprise/)).not.toBeInTheDocument()
    expect(screen.queryByText(/guidance:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/reaction:/i)).not.toBeInTheDocument()
  })

  it('renders the history strip only in the hero variant', () => {
    const first = render(<EarningsReportCard card={modelFor('AAPL')} variant="hero" />)
    expect(screen.getByText(/quarters beat EPS/)).toBeInTheDocument()
    first.unmount()

    render(<EarningsReportCard card={modelFor('AAPL')} variant="compact" />)
    expect(screen.queryByText(/quarters beat EPS/)).not.toBeInTheDocument()
  })

  it('never renders the interpretation itself — that is the caller/children\'s job', () => {
    render(<EarningsReportCard card={modelFor('AAPL')} />)
    expect(screen.queryByText(/Generated interpretation/)).not.toBeInTheDocument()
  })

  it('renders provided children below the card body (drawer composition slot)', () => {
    render(
      <EarningsReportCard card={modelFor('AAPL')}>
        <div>slot content</div>
      </EarningsReportCard>,
    )
    expect(screen.getByText('slot content')).toBeInTheDocument()
  })

  it('is a clickable, keyboard-activatable button when onSelect is provided', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<EarningsReportCard card={modelFor('AAPL')} onSelect={onSelect} />)
    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalled()
  })

  it('is a static article (no button role) when onSelect is omitted', () => {
    render(<EarningsReportCard card={modelFor('AAPL')} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides the EPS/Revenue block and shows one honest line when there is no consensus or actual data at all', () => {
    const card = modelFor('AAPL')
    const bareCard = { ...card, facts: card.facts ? { ...card.facts, consensus: undefined, actual: undefined } : card.facts }
    render(<EarningsReportCard card={bareCard} />)
    expect(screen.queryByText('EPS')).not.toBeInTheDocument()
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
    expect(screen.queryByText(/no estimate available/i)).not.toBeInTheDocument()
    expect(screen.getByText('No consensus estimates available yet.')).toBeInTheDocument()
  })
})
