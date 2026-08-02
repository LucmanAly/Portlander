import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ForwardExposurePanel } from '@/components/exposure/ForwardExposurePanel'
import type { ExposureSummary } from '@/types'

function exposure(overrides: Partial<ExposureSummary> = {}): ExposureSummary {
  return {
    earnings7dPct: 10,
    earnings30dPct: 20,
    nextCritical: null,
    totalPortfolioValue: 10_000,
    holdingsCount: 5,
    ...overrides,
  }
}

describe('ForwardExposurePanel', () => {
  it('renders all 3 columns', () => {
    render(<ForwardExposurePanel exposure={exposure()} />)
    expect(screen.getByText('Earnings · 7 days')).toBeInTheDocument()
    expect(screen.getByText('Earnings · 30 days')).toBeInTheDocument()
    expect(screen.getByText('Next critical')).toBeInTheDocument()
  })

  it('shows an honest empty state when there is no next-critical event', () => {
    render(<ForwardExposurePanel exposure={exposure({ nextCritical: null })} />)
    expect(screen.getByText('No critical events in window')).toBeInTheDocument()
  })

  it('shows the next critical ticker and timing hint when present', () => {
    render(
      <ForwardExposurePanel
        exposure={exposure({
          nextCritical: {
            id: 'e1',
            ticker: 'MSFT',
            title: 'Microsoft earnings',
            eventType: 'earnings',
            eventDate: new Date().toISOString().slice(0, 10),
            timing: 'amc',
            status: 'confirmed',
            positionWeightPct: 24,
            impactScore: 77,
            impactBreakdown: { weightComponent: 40, typeComponent: 20, recencyComponent: 10 },
            isHolding: true,
            isWatchlist: false,
            marketValue: 14_875,
          },
        })}
      />,
    )
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.getByText(/impact 77/)).toBeInTheDocument()
  })
})
