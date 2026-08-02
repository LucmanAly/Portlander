import clsx from 'clsx'

export type SortMode = 'impact' | 'date'

const OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'impact', label: 'Impact' },
  { id: 'date', label: 'Date' },
]

export function SortToggle({
  value,
  onChange,
}: {
  value: SortMode
  onChange: (m: SortMode) => void
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
              : 'text-ink-450 hover:text-ink-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
