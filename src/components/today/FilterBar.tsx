import clsx from 'clsx'
import type { EventFilter } from '@/types'

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
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={clsx(
            'focus-ring rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150',
            value === f.id
              ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/40'
              : 'bg-ink-850 text-ink-400 ring-1 ring-border hover:text-ink-200',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
