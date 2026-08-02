import { useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { Button } from '@/components/ui/Button'

/**
 * Single shared drawer/sheet primitive: a right-side drawer on desktop (`lg:`),
 * a bottom sheet on mobile — same component, responsive classes, not two.
 * No swipe-to-dismiss: not required by UX-05's acceptance criteria, and it
 * would risk conflicting with ordinary page-scroll gestures on the sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const onEscape = useCallback(() => onClose(), [onClose])
  const containerRef = useFocusTrap<HTMLDivElement>(open, onEscape)

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className="surface-elevated fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5 outline-none lg:inset-x-auto lg:right-0 lg:top-0 lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-l-2xl lg:rounded-t-none"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="dialog-title" className="text-lg font-semibold text-ink-100">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
