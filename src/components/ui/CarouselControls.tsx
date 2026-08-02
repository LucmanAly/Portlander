import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

/** Presentational dots + prev/next. No swipe/drag logic — that lives in useSwipe (Today's deck). */
export function CarouselControls({
  count,
  activeIndex,
  onSelect,
  onPrev,
  onNext,
  labelForIndex,
}: {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  onPrev: () => void
  onNext: () => void
  labelForIndex?: (index: number) => string
}) {
  if (count <= 1) return null

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={activeIndex === 0}
        aria-label="Previous"
        className="focus-ring rounded-lg p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5" role="tablist" aria-label="Cards">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={labelForIndex ? labelForIndex(i) : `Card ${i + 1} of ${count}`}
            onClick={() => onSelect(i)}
            className={clsx(
              'focus-ring h-1.5 rounded-full transition-all',
              i === activeIndex ? 'w-4 bg-accent-500' : 'w-1.5 bg-ink-700 hover:bg-ink-600',
            )}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={activeIndex === count - 1}
        aria-label="Next"
        className="focus-ring rounded-lg p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
