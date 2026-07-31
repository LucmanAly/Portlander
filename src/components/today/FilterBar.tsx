import clsx from 'clsx'
import type { EventFilter } from '@/types'

const FILTERS: { id: EventFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'dividends', label: 'Dividends' },
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
