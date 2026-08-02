import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSwipe } from '@/lib/useSwipe'

function pointerEvent(clientX: number) {
  return { clientX } as unknown as Parameters<ReturnType<typeof useSwipe>['onPointerDown']>[0]
}

describe('useSwipe', () => {
  it('calls onSwipeLeft when the drag exceeds the threshold leftward', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    result.current.onPointerDown(pointerEvent(200))
    result.current.onPointerUp(pointerEvent(120))

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('calls onSwipeRight when the drag exceeds the threshold rightward', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    result.current.onPointerDown(pointerEvent(100))
    result.current.onPointerUp(pointerEvent(180))

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('calls neither when the drag is under the threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    result.current.onPointerDown(pointerEvent(100))
    result.current.onPointerUp(pointerEvent(120))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('resets on pointer cancel without firing a swipe', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    result.current.onPointerDown(pointerEvent(200))
    result.current.onPointerCancel()
    result.current.onPointerUp(pointerEvent(50))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
