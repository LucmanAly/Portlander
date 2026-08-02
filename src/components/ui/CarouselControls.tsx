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
  arrowsHiddenBelowLg = false,
}: {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  onPrev: () => void
  onNext: () => void
  labelForIndex?: (index: number) => string
  /** Hide the prev/next buttons below the `lg:` breakpoint — useful once touch swipe covers mobile. */
  arrowsHiddenBelowLg?: boolean
}) {
  if (count <= 1) return null

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={activeIndex === 0}
        aria-label="Previous"
        className={clsx(
          'focus-ring rounded-lg p-2.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30',
          arrowsHiddenBelowLg && 'hidden lg:inline-flex',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center" role="tablist" aria-label="Cards">
        {Array.from({ length: count }, (_, i) => (
          // Visible dot stays small/dense; the button itself pads out to a
          // real touch target rather than growing the dot to match.
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={labelForIndex ? labelForIndex(i) : `Card ${i + 1} of ${count}`}
            onClick={() => onSelect(i)}
            className="focus-ring flex items-center justify-center p-2.5"
          >
            <span
              className={clsx(
                'h-1.5 rounded-full transition-all',
                i === activeIndex ? 'w-4 bg-accent-500' : 'w-1.5 bg-ink-700',
              )}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={activeIndex === count - 1}
        aria-label="Next"
        className={clsx(
          'focus-ring rounded-lg p-2.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30',
          arrowsHiddenBelowLg && 'hidden lg:inline-flex',
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
