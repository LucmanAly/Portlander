import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFocusTrap } from '@/lib/useFocusTrap'

function TestHarness({ active, onEscape }: { active: boolean; onEscape: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(active, onEscape)
  return (
    <div>
      <button type="button">Outside trigger</button>
      {active ? (
        <div ref={ref} tabIndex={-1} data-testid="trap">
          <button type="button">First</button>
          <button type="button">Second</button>
          <button type="button">Last</button>
        </div>
      ) : null}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the container when activated', () => {
    render(<TestHarness active={true} onEscape={() => {}} />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('restores focus to the previously-focused element on deactivation', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(<TestHarness active={true} onEscape={() => {}} />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    rerender(<TestHarness active={false} onEscape={() => {}} />)
    expect(trigger).toHaveFocus()

    trigger.remove()
  })

  it('calls onEscape when Escape is pressed', () => {
    const onEscape = vi.fn()
    render(<TestHarness active={true} onEscape={onEscape} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab from the last focusable to the first', () => {
    render(<TestHarness active={true} onEscape={() => {}} />)
    screen.getByRole('button', { name: 'Last' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first focusable to the last', () => {
    render(<TestHarness active={true} onEscape={() => {}} />)
    screen.getByRole('button', { name: 'First' }).focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('does nothing when inactive', () => {
    const onEscape = vi.fn()
    render(<TestHarness active={false} onEscape={onEscape} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
  })
})
