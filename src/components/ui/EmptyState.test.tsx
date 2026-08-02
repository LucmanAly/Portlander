import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Add something to get started." />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument()
  })

  it('omits the CTA link when not provided', () => {
    render(<EmptyState title="Nothing here" description="Add something." />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders a CTA link when both ctaLabel and ctaTo are provided', () => {
    render(
      <MemoryRouter>
        <EmptyState title="Nothing here" description="Add something." ctaLabel="Go" ctaTo="/portfolio" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/portfolio')
  })
})
