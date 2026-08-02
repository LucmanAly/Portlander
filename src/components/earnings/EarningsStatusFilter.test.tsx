import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EarningsStatusFilter, filterEarningsByStatus } from '@/components/earnings/EarningsStatusFilter'
import { buildEarningsCardModel } from '@/lib/earningsIntel'
import type { ScoredEvent } from '@/types'

const TODAY = new Date(2026, 7, 10) // 2026-08-10

function card(ticker: string, eventDate: string, hasActual: boolean) {
  const event: ScoredEvent = {
    id: `ev-${ticker}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate,
    timing: 'amc',
    status: 'confirmed',
    positionWeightPct: 5,
    impactScore: 50,
    impactBreakdown: { weightComponent: 3, typeComponent: 1, recencyComponent: 1 },
    isHolding: true,
    isWatchlist: false,
    marketValue: 1000,
  }
  return buildEarningsCardModel(event, hasActual ? { actual: { epsActual: 1 } } : undefined, undefined, TODAY)
}

describe('filterEarningsByStatus', () => {
  const upcoming = card('UP', '2026-08-20', false)
  const awaiting = card('AWT', '2026-08-09', false)
  const recentReport = card('REC', '2026-08-05', true) // 5 days ago, reported
  const oldReport = card('OLD', '2026-07-01', true) // 40 days ago, reported

  const all = [upcoming, awaiting, recentReport, oldReport]

  it('active = awaiting only', () => {
    expect(filterEarningsByStatus(all, 'active', TODAY).map((c) => c.ticker)).toEqual(['AWT'])
  })

  it('upcoming = upcoming only', () => {
    expect(filterEarningsByStatus(all, 'upcoming', TODAY).map((c) => c.ticker)).toEqual(['UP'])
  })

  it('recent = reported within 7 days, excludes older reports', () => {
    expect(filterEarningsByStatus(all, 'recent', TODAY).map((c) => c.ticker)).toEqual(['REC'])
  })

  it('all = everything, unfiltered', () => {
    expect(filterEarningsByStatus(all, 'all', TODAY)).toHaveLength(4)
  })
})

describe('EarningsStatusFilter', () => {
  it('renders all 4 options and marks the active one', () => {
    render(<EarningsStatusFilter value="upcoming" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EarningsStatusFilter value="all" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Recently reported' }))
    expect(onChange).toHaveBeenCalledWith('recent')
  })
})
