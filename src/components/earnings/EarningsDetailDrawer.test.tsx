import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EarningsDetailDrawer } from '@/components/earnings/EarningsDetailDrawer'
import { buildEarningsCardModel } from '@/lib/earningsIntel'
import { EARNINGS_FIXTURES, FIXTURE_TODAY } from '@/data/earningsFixtures'
import type { ScoredEvent } from '@/types'

function scoredEvent(ticker: string, eventDate: string, overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: `ev-${ticker}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate,
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 12,
    impactScore: 60,
    impactBreakdown: { weightComponent: 30, typeComponent: 20, recencyComponent: 10 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 5000,
    ...overrides,
  }
}

function reportedCard(ticker: string) {
  const facts = EARNINGS_FIXTURES[ticker]
  return buildEarningsCardModel(scoredEvent(ticker, '2026-07-31'), facts, facts?.interpretation, FIXTURE_TODAY)
}

function upcomingCard(ticker: string) {
  const facts = EARNINGS_FIXTURES[ticker]
  return buildEarningsCardModel(scoredEvent(ticker, '2026-08-10'), facts, facts?.interpretation, FIXTURE_TODAY)
}

describe('EarningsDetailDrawer', () => {
  it('renders nothing (closed dialog) when card is null', () => {
    render(<EarningsDetailDrawer card={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows verified facts, exposure, guidance, source, and history for a reported card, and the generated section last', () => {
    render(<EarningsDetailDrawer card={reportedCard('AAPL')} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const sectionHeadings = Array.from(dialog.querySelectorAll('h3')).map((h) => h.textContent)
    expect(sectionHeadings).toEqual(['Financials', 'Portfolio exposure', 'Guidance', 'Reaction', 'Source', 'History'])
    expect(screen.getByText('Generated interpretation — not verified')).toBeInTheDocument()

    // Generated section is the last child in DOM order, after every verified section.
    const allSections = Array.from(dialog.querySelectorAll('section, div.border-t'))
    expect(allSections[allSections.length - 1].textContent).toContain('Generated interpretation')
  })

  it('omits guidance/reaction sections entirely for an upcoming card rather than rendering them empty', () => {
    render(<EarningsDetailDrawer card={upcomingCard('RIVN')} onClose={() => {}} />)
    expect(screen.queryByText('Guidance')).not.toBeInTheDocument()
    expect(screen.queryByText('Reaction')).not.toBeInTheDocument()
  })

  it('does not damage the rest of the drawer when interpretation is absent', () => {
    render(<EarningsDetailDrawer card={upcomingCard('RIVN')} onClose={() => {}} />)
    expect(screen.queryByText('Generated interpretation — not verified')).not.toBeInTheDocument()
    expect(screen.getByText('Financials')).toBeInTheDocument()
    expect(screen.getByText('Portfolio exposure')).toBeInTheDocument()
  })

  it('shows "Not held" instead of a weight for a non-holding card', () => {
    render(<EarningsDetailDrawer card={upcomingCard('RIVN')} onClose={() => {}} />)
    expect(screen.queryByText('Not held')).not.toBeInTheDocument() // fixture default has isHolding: true

    const notHeld = buildEarningsCardModel(
      scoredEvent('RIVN', '2026-08-10', { isHolding: false, positionWeightPct: 0 }),
      EARNINGS_FIXTURES.RIVN,
      undefined,
      FIXTURE_TODAY,
    )
    render(<EarningsDetailDrawer card={notHeld} onClose={() => {}} />)
    expect(screen.getByText('Not held')).toBeInTheDocument()
  })

  it('supports a full keyboard-tab traversal without escaping the dialog', async () => {
    const user = userEvent.setup()
    render(<EarningsDetailDrawer card={reportedCard('AAPL')} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')

    // Tab all the way through; every focused element should stay inside the dialog.
    for (let i = 0; i < 8; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})
