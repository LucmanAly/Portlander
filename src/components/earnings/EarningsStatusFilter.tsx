import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { EarningsCardModel } from '@/types/earnings'
import { PillButton } from '@/components/ui/Button'

export type EarningsStatusFilterValue = 'active' | 'upcoming' | 'recent' | 'all'

const OPTIONS: { id: EarningsStatusFilterValue; label: string }[] = [
  { id: 'active', label: 'Awaiting results' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'recent', label: 'Recently reported' },
  { id: 'all', label: 'All' },
]

const RECENT_WINDOW_DAYS = 7

/** Active = awaiting results. Recently reported = reported within the last 7 days. */
export function filterEarningsByStatus(
  cards: EarningsCardModel[],
  filter: EarningsStatusFilterValue,
  today: Date = new Date(),
): EarningsCardModel[] {
  switch (filter) {
    case 'active':
      return cards.filter((c) => c.viewState === 'awaiting')
    case 'upcoming':
      return cards.filter((c) => c.viewState === 'upcoming')
    case 'recent':
      return cards.filter((c) => {
        if (c.viewState !== 'reported') return false
        const days = differenceInCalendarDays(today, parseISO(c.eventDate))
        return days >= 0 && days <= RECENT_WINDOW_DAYS
      })
    case 'all':
      return cards
  }
}

export function EarningsStatusFilter({
  value,
  onChange,
}: {
  value: EarningsStatusFilterValue
  onChange: (v: EarningsStatusFilterValue) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <PillButton key={opt.id} active={value === opt.id} onClick={() => onChange(opt.id)}>
          {opt.label}
        </PillButton>
      ))}
    </div>
  )
}
