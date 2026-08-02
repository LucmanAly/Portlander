import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { EarningsCardModel } from '@/types/earnings'
import { EarningsReportCard } from '@/components/earnings/EarningsReportCard'
import { EarningsDetailDrawer } from '@/components/earnings/EarningsDetailDrawer'
import { CarouselControls } from '@/components/ui/CarouselControls'
import { useSwipe } from '@/lib/useSwipe'

/**
 * One dominant hero card with a visible next-card peek. Dots are visible at
 * all widths (a cheap, useful position indicator even once swipe works);
 * arrows are desktop-only (redundant once swipe works, and risk conflicting
 * with a touch drag). Card selection opens the shared detail drawer.
 */
export function EarningsDeck({
  cards,
  onSelectCard,
}: {
  cards: EarningsCardModel[]
  onSelectCard?: (card: EarningsCardModel) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedCard, setSelectedCard] = useState<EarningsCardModel | null>(null)
  const clampedIndex = Math.min(activeIndex, Math.max(0, cards.length - 1))

  const goTo = (i: number) => setActiveIndex(Math.max(0, Math.min(cards.length - 1, i)))
  const swipe = useSwipe({
    onSwipeLeft: () => goTo(clampedIndex + 1),
    onSwipeRight: () => goTo(clampedIndex - 1),
  })

  if (cards.length === 0) {
    return (
      <div className="surface-elevated rounded-2xl px-6 py-10 text-center">
        <p className="text-sm text-ink-300">Nothing reporting in the next day.</p>
        <Link
          to="/earnings"
          className="focus-ring mt-3 inline-flex text-sm font-medium text-accent-400 hover:text-accent-300"
        >
          View the full Earnings workspace →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden"
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
        <div
          className="flex transition-transform duration-200 ease-out"
          style={{ transform: `translateX(calc(-${clampedIndex} * (100% - 2rem)))` }}
        >
          {cards.map((card) => (
            <div key={card.id} className="mr-4 w-[calc(100%-2rem)] shrink-0">
              <EarningsReportCard
                card={card}
                variant="hero"
                onSelect={() => {
                  setSelectedCard(card)
                  onSelectCard?.(card)
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {cards.length > 1 ? (
        <div className="flex justify-center">
          <CarouselControls
            count={cards.length}
            activeIndex={clampedIndex}
            onSelect={goTo}
            onPrev={() => goTo(clampedIndex - 1)}
            onNext={() => goTo(clampedIndex + 1)}
            labelForIndex={(i) => `${cards[i].ticker} card`}
            arrowsHiddenBelowLg
          />
        </div>
      ) : null}

      <EarningsDetailDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  )
}
