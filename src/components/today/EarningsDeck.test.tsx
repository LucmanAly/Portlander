import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EarningsDeck } from '@/components/today/EarningsDeck'
import { buildEarningsCardModel } from '@/lib/earningsIntel'
import { EARNINGS_FIXTURES, FIXTURE_TODAY } from '@/data/earningsFixtures'
import type { ScoredEvent } from '@/types'

function cardFor(ticker: string, eventDate: string) {
  const event: ScoredEvent = {
    id: `ev-${ticker}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate,
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 10,
    impactScore: 60,
    impactBreakdown: { weightComponent: 30, typeComponent: 20, recencyComponent: 10 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 5000,
  }
  const facts = EARNINGS_FIXTURES[ticker]
  return buildEarningsCardModel(event, facts, facts?.interpretation, FIXTURE_TODAY)
}

function renderDeck(cards: ReturnType<typeof cardFor>[], onSelectCard?: (c: unknown) => void) {
  return render(
    <MemoryRouter>
      <EarningsDeck cards={cards} onSelectCard={onSelectCard} />
    </MemoryRouter>,
  )
}

describe('EarningsDeck', () => {
  it('shows an honest empty state with a link to Earnings when there are no cards', () => {
    renderDeck([])
    expect(screen.getByText(/nothing reporting/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /earnings workspace/i })).toHaveAttribute('href', '/earnings')
  })

  it('renders a single hero card with no carousel controls when there is 1 card', () => {
    renderDeck([cardFor('AAPL', '2026-08-02')])
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('renders carousel controls with dots for one per card when there are multiple', () => {
    renderDeck([cardFor('AAPL', '2026-08-02'), cardFor('TSLA', '2026-08-02')])
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('calls onSelectCard when a card is clicked', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    renderDeck([cardFor('AAPL', '2026-08-02')], onSelectCard)
    await user.click(screen.getByRole('button', { name: /AAPL/ }))
    expect(onSelectCard).toHaveBeenCalledTimes(1)
  })

  it('advances to the next card via the Next control', async () => {
    const user = userEvent.setup()
    renderDeck([cardFor('AAPL', '2026-08-02'), cardFor('TSLA', '2026-08-02')])
    await user.click(screen.getByRole('tab', { name: /TSLA/ }))
    expect(screen.getByRole('tab', { name: /TSLA/ })).toHaveAttribute('aria-selected', 'true')
  })
})
