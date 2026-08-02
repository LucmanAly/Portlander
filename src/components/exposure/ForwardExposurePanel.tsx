import { formatPct } from '@/lib/format'
import type { ExposureSummary } from '@/types'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import clsx from 'clsx'

/**
 * Replaces ExposureStrip's 3 separate Stat cards with one compact panel —
 * same 3 numbers, hairline-divided columns. Placed in a neutral exposure/
 * folder (not today/) because the Earnings workspace (UX-04) reuses this
 * verbatim for its own exposure summary.
 */
export function ForwardExposurePanel({ exposure }: { exposure: ExposureSummary }) {
  const next = exposure.nextCritical
  let nextHint = 'No critical events in window'
  let nextValue = '—'
  if (next) {
    const days = differenceInCalendarDays(parseISO(next.eventDate), new Date())
    nextValue = next.ticker ?? next.title.slice(0, 12)
    nextHint =
      days === 0
        ? `Today · impact ${next.impactScore}`
        : days === 1
          ? `Tomorrow · impact ${next.impactScore}`
          : `In ${days}d · impact ${next.impactScore}`
  }

  return (
    <div className="surface grid divide-y divide-border rounded-2xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Column
        label="Earnings · 7 days"
        value={formatPct(exposure.earnings7dPct)}
        hint="Portfolio weight reporting"
        tone={exposure.earnings7dPct >= 25 ? 'earnings' : 'default'}
      />
      <Column
        label="Earnings · 30 days"
        value={formatPct(exposure.earnings30dPct)}
        hint="Forward event risk"
        tone={exposure.earnings30dPct >= 40 ? 'critical' : 'default'}
      />
      <Column label="Next critical" value={nextValue} hint={nextHint} tone="accent" />
    </div>
  )
}

function Column({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'default' | 'accent' | 'earnings' | 'critical'
}) {
  return (
    <div className="min-w-0 flex-1 px-4 py-3">
      <div className="text-xs font-medium text-ink-450">{label}</div>
      <div
        className={clsx(
          'tabular mt-1 truncate text-xl font-semibold tracking-tight',
          tone === 'accent' && 'text-accent-400',
          tone === 'earnings' && 'text-earnings',
          tone === 'critical' && 'text-critical',
          tone === 'default' && 'text-ink-100',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-ink-450">{hint}</div>
    </div>
  )
}
