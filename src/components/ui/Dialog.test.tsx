import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '@/components/ui/Dialog'

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders with dialog role, aria-modal, and the title when open', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Detail' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <Dialog open={true} onClose={onClose} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    const backdrop = container.ownerDocument.querySelector('.bg-black\\/60')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the Close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open={true} onClose={onClose} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <Dialog open={true} onClose={onClose} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and restores it on close', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <Dialog open={true} onClose={() => {}} title="Detail">
        <button type="button">First focusable</button>
      </Dialog>,
    )
    // The Close button is the first focusable element in DOM order (it's in
    // the header, before `children`), so that's what receives initial focus.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    rerender(
      <Dialog open={false} onClose={() => {}} title="Detail">
        <button type="button">First focusable</button>
      </Dialog>,
    )
    expect(trigger).toHaveFocus()

    trigger.remove()
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(
      <Dialog open={true} onClose={() => {}} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Dialog open={false} onClose={() => {}} title="Detail">
        <p>body</p>
      </Dialog>,
    )
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
