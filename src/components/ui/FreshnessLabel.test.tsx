import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessLabel } from '@/components/ui/FreshnessLabel'

describe('FreshnessLabel', () => {
  it('renders "Source unknown" when provenance is undefined', () => {
    render(<FreshnessLabel />)
    expect(screen.getByText('Source unknown')).toBeInTheDocument()
  })

  it('renders the source and freshness when provenance is present', () => {
    render(<FreshnessLabel provenance={{ source: 'Finnhub' }} />)
    expect(screen.getByText(/Finnhub/)).toBeInTheDocument()
  })

  it('flags an estimate-fallback provenance visually', () => {
    render(
      <FreshnessLabel
        provenance={{ source: 'Finnhub (cached)', fetchedAt: '2026-07-29T21:00:00Z', isEstimateFallback: true }}
      />,
    )
    expect(screen.getByText('Estimated, not observed')).toBeInTheDocument()
  })
})
