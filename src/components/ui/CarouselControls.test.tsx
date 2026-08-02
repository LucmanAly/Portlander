import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CarouselControls } from '@/components/ui/CarouselControls'

describe('CarouselControls', () => {
  it('renders nothing for a single card', () => {
    const { container } = render(
      <CarouselControls count={1} activeIndex={0} onSelect={() => {}} onPrev={() => {}} onNext={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one focusable dot per card with a descriptive aria-label', () => {
    render(<CarouselControls count={3} activeIndex={1} onSelect={() => {}} onPrev={() => {}} onNext={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Card 1 of 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Card 2 of 3' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Card 3 of 3' })).toBeInTheDocument()
  })

  it('calls onSelect with the clicked dot index via keyboard activation', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CarouselControls count={3} activeIndex={0} onSelect={onSelect} onPrev={() => {}} onNext={() => {}} />)
    await user.tab() // focus Previous (disabled, skipped) -> first dot
    const secondDot = screen.getByRole('tab', { name: 'Card 2 of 3' })
    secondDot.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('disables Previous at the first card and Next at the last', () => {
    render(<CarouselControls count={3} activeIndex={0} onSelect={() => {}} onPrev={() => {}} onNext={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })

  it('calls onNext/onPrev from their buttons', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onPrev = vi.fn()
    render(<CarouselControls count={3} activeIndex={1} onSelect={() => {}} onPrev={onPrev} onNext={onNext} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })
})
