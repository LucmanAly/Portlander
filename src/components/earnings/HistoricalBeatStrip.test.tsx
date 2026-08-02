import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoricalBeatStrip } from '@/components/earnings/HistoricalBeatStrip'

describe('HistoricalBeatStrip', () => {
  it('renders an honest empty state for undefined history', () => {
    render(<HistoricalBeatStrip />)
    expect(screen.getByText('No earnings history available.')).toBeInTheDocument()
  })

  it('renders an honest empty state for an empty array (recent IPO)', () => {
    render(<HistoricalBeatStrip history={[]} />)
    expect(screen.getByText('No earnings history available.')).toBeInTheDocument()
  })

  it('summarizes known beats and flags unknown quarters', () => {
    render(
      <HistoricalBeatStrip
        history={[
          { quarter: 'Q2 2026', epsBeat: true, revenueBeat: true },
          { quarter: 'Q1 2026', epsBeat: false, revenueBeat: false },
          { quarter: 'Q4 2025', epsBeat: null, revenueBeat: null },
        ]}
      />,
    )
    expect(screen.getByText('1 of 2 quarters beat EPS (1 unknown)')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('treats a null-only history as unconfirmed, not a beat/miss', () => {
    render(<HistoricalBeatStrip history={[{ quarter: 'Q2 2026', epsBeat: null, revenueBeat: null }]} />)
    expect(screen.getByText('No confirmed EPS history yet')).toBeInTheDocument()
  })
})
