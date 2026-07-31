import clsx from 'clsx'

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: 'default' | 'accent' | 'earnings' | 'critical'
}) {
  return (
    <div className="surface flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-4 py-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
        {label}
      </span>
      <span
        className={clsx(
          'tabular text-2xl font-semibold tracking-tight',
          accent === 'accent' && 'text-accent-400',
          accent === 'earnings' && 'text-earnings',
          accent === 'critical' && 'text-critical',
          (!accent || accent === 'default') && 'text-ink-100',
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-ink-500">{hint}</span> : null}
    </div>
  )
}
