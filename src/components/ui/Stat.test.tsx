import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stat } from '@/components/ui/Stat'

describe('Stat', () => {
  it('renders label, value, and hint', () => {
    render(<Stat label="Total value" value="$1,234" hint="as of today" />)
    expect(screen.getByText('Total value')).toBeInTheDocument()
    expect(screen.getByText('$1,234')).toBeInTheDocument()
    expect(screen.getByText('as of today')).toBeInTheDocument()
  })

  it('omits the hint line when not provided', () => {
    render(<Stat label="Total value" value="$1,234" />)
    expect(screen.queryByText('as of today')).not.toBeInTheDocument()
  })

  it.each([
    ['default', 'text-ink-100'],
    ['accent', 'text-accent-400'],
    ['earnings', 'text-earnings'],
    ['critical', 'text-critical'],
    ['positive', 'text-positive'],
  ] as const)('applies the %s accent class', (accent, expectedClass) => {
    render(<Stat label="L" value="V" accent={accent} />)
    expect(screen.getByText('V')).toHaveClass(expectedClass)
  })
})
