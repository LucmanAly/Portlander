import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PerformanceRecapCard } from '@/components/performance/PerformanceRecapCard'
import type { PerformanceSummary } from '@/types/performance'

const summary: PerformanceSummary = {
  period: 'range',
  requestedStartDate: '2026-06-05',
  requestedEndDate: '2026-07-10',
  effectiveStartDate: '2026-06-05',
  effectiveEndDate: '2026-07-10',
  startValue: 1_000,
  endValue: 1_060,
  valueChange: 60,
  pctChange: 6,
  direction: 'gain',
  hasPositionChanges: true,
  overlappingThemes: true,
  holdingsCount: 2,
  summaryKey: 'performance-1234abcd',
  tickerAttribution: [
    { id: 'ticker:CRWD', label: 'CRWD', tickers: ['CRWD'], startValue: 500, endValue: 560, valueChange: 60, pctChange: 12 },
  ],
  themeAttribution: [
    { id: 'theme:cybersecurity', label: 'Cybersecurity', tickers: ['CRWD'], startValue: 500, endValue: 560, valueChange: 60, pctChange: 12 },
  ],
}

describe('PerformanceRecapCard', () => {
  it('keeps verified figures distinct and warns when trades or flows affected the comparison', () => {
    render(
      <PerformanceRecapCard
        title="Selected-period recap"
        summary={summary}
        emptyMessage="No data"
        enableNarrative={false}
      />,
    )
    expect(screen.getByText('Selected-period recap')).toBeInTheDocument()
    expect(screen.getAllByText(/\+\$60\.00/)).toHaveLength(3)
    expect(screen.getByText('Cybersecurity')).toBeInTheDocument()
    expect(screen.getByText(/may include trades or cash flows/i)).toBeInTheDocument()
    expect(screen.getByText(/Sign in to generate/i)).toBeInTheDocument()
  })

  it('renders an honest collection state when no summary exists', () => {
    render(
      <PerformanceRecapCard
        title="This week"
        emptyMessage="Two captures are required."
        enableNarrative={false}
      />,
    )
    expect(screen.getByText('Two captures are required.')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })
})
