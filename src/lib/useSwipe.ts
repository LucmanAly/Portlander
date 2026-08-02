import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Pointer Events unify touch + mouse-drag in one handler set (and are
 * dispatchable in tests via fireEvent.pointerDown/Move/Up, unlike raw
 * TouchEvents in jsdom).
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  threshold?: number
}) {
  const startX = useRef<number | null>(null)

  function onPointerDown(e: ReactPointerEvent) {
    startX.current = e.clientX
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (startX.current == null) return
    const delta = e.clientX - startX.current
    startX.current = null
    if (delta <= -threshold) onSwipeLeft()
    else if (delta >= threshold) onSwipeRight()
  }

  function onPointerCancel() {
    startX.current = null
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  }
}
