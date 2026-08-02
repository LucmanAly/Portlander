import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricPair } from '@/components/ui/MetricPair'

const fmt = (n: number) => `$${n.toFixed(2)}`

describe('MetricPair', () => {
  it('renders both estimate and actual', () => {
    render(<MetricPair label="EPS" estimate={1.5} actual={1.64} format={fmt} />)
    expect(screen.getByText('$1.64')).toBeInTheDocument()
    expect(screen.getByText('est. $1.50')).toBeInTheDocument()
  })

  it('renders estimate-only honestly (pre-release)', () => {
    render(<MetricPair label="EPS" estimate={1.5} format={fmt} />)
    expect(screen.getByText('est. $1.50')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders actual-only honestly (no consensus baseline)', () => {
    render(<MetricPair label="EPS" actual={1.64} format={fmt} />)
    expect(screen.getByText('$1.64')).toBeInTheDocument()
    expect(screen.getByText('no estimate available')).toBeInTheDocument()
  })

  it('renders neither honestly, never a fabricated value', () => {
    render(<MetricPair label="EPS" format={fmt} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('no estimate available')).toBeInTheDocument()
  })
})
