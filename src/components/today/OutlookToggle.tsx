import clsx from 'clsx'
import type { OutlookDays } from '@/types'

const OPTIONS: { id: OutlookDays; label: string }[] = [
  { id: 15, label: '15d' },
  { id: 45, label: '45d' },
]

export function OutlookToggle({
  value,
  onChange,
}: {
  value: OutlookDays
  onChange: (d: OutlookDays) => void
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-ink-850 p-0.5 ring-1 ring-border">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={clsx(
            'focus-ring rounded-md px-2.5 py-1 text-xs font-medium transition duration-150',
            value === opt.id
              ? 'bg-accent-500/15 text-accent-400'
              : 'text-ink-500 hover:text-ink-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
