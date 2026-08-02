import type { EventFilter } from '@/types'
import { PillButton } from '@/components/ui/Button'

// No 'Dividends' chip: no sync path fetches ex-dividend dates, so against real
// data the filter is always empty. The 'dividends' EventFilter and its scoring
// branch stay — put the chip back the day ex-div fetching exists.
const FILTERS: { id: EventFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'macro', label: 'Macro' },
  { id: 'holdings', label: 'Holdings only' },
]

export function FilterBar({
  value,
  onChange,
}: {
  value: EventFilter
  onChange: (f: EventFilter) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <PillButton key={f.id} active={value === f.id} onClick={() => onChange(f.id)}>
          {f.label}
        </PillButton>
      ))}
    </div>
  )
}
