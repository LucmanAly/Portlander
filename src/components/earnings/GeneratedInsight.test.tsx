import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GeneratedInsight } from '@/components/earnings/GeneratedInsight'

describe('GeneratedInsight', () => {
  it('renders nothing when interpretation is undefined', () => {
    const { container } = render(<GeneratedInsight />)
    expect(container).toBeEmptyDOMElement()
  })

  it('labels the section as generated, not verified', () => {
    render(<GeneratedInsight interpretation={{ summary: 'Beat expectations across the board.' }} />)
    expect(screen.getByText('Generated interpretation — not verified')).toBeInTheDocument()
    expect(screen.getByText('Beat expectations across the board.')).toBeInTheDocument()
  })

  it('shows model/confidence caption when present', () => {
    render(
      <GeneratedInsight
        interpretation={{ summary: 'Summary', model: 'deepseek-v3', confidence: 'medium' }}
      />,
    )
    expect(screen.getByText('deepseek-v3 · medium confidence')).toBeInTheDocument()
  })
})
