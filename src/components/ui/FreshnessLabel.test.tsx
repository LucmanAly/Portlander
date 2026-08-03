import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessLabel } from '@/components/ui/FreshnessLabel'

describe('FreshnessLabel', () => {
  it('renders nothing when provenance is undefined, rather than an alarming placeholder', () => {
    const { container } = render(<FreshnessLabel />)
    expect(container).toBeEmptyDOMElement()
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
