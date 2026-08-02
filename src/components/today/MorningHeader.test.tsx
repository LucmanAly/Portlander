import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MorningHeader } from '@/components/today/MorningHeader'

describe('MorningHeader', () => {
  it('renders total value, holdings count, and sync time', () => {
    render(
      <MorningHeader
        totalValue={61_215}
        dayChange={620}
        dayChangePct={1.02}
        lastSyncAt="2026-08-02T12:00:00Z"
        holdingsCount={6}
      />,
    )
    expect(screen.getByText('$61,215')).toBeInTheDocument()
    expect(screen.getByText(/6 holdings/)).toBeInTheDocument()
  })

  it('shows an honest unavailable message when day change is undefined, never a fabricated 0%', () => {
    render(<MorningHeader totalValue={61_215} lastSyncAt={null} holdingsCount={6} />)
    expect(screen.getByText(/day change unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
  })

  it('shows a positive day change with a + prefix', () => {
    render(
      <MorningHeader totalValue={1000} dayChange={50} dayChangePct={5} lastSyncAt={null} holdingsCount={1} />,
    )
    expect(
      screen.getByText((_, el) => el?.textContent === '+$50.00 (+5.0% today)'),
    ).toBeInTheDocument()
  })

  it('shows a negative day change without a double negative sign', () => {
    render(
      <MorningHeader totalValue={1000} dayChange={-50} dayChangePct={-5} lastSyncAt={null} holdingsCount={1} />,
    )
    expect(
      screen.getByText((_, el) => el?.textContent === '-$50.00 (-5.0% today)'),
    ).toBeInTheDocument()
  })
})
