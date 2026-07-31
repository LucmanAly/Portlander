import { Stat } from '@/components/ui/Stat'
import { formatPct } from '@/lib/format'
import type { ExposureSummary } from '@/types'
import { differenceInCalendarDays, parseISO } from 'date-fns'

export function ExposureStrip({ exposure }: { exposure: ExposureSummary }) {
  const next = exposure.nextCritical
  let nextHint = 'No critical events in window'
  let nextValue = '—'
  if (next) {
    const days = differenceInCalendarDays(parseISO(next.eventDate), new Date())
    nextValue =
      next.ticker ?? next.title.slice(0, 12)
    nextHint =
      days === 0
        ? `Today · impact ${next.impactScore}`
        : days === 1
          ? `Tomorrow · impact ${next.impactScore}`
          : `In ${days}d · impact ${next.impactScore}`
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Earnings · 7 days"
        value={formatPct(exposure.earnings7dPct)}
        hint="Portfolio weight reporting"
        accent={exposure.earnings7dPct >= 25 ? 'earnings' : 'default'}
      />
      <Stat
        label="Earnings · 30 days"
        value={formatPct(exposure.earnings30dPct)}
        hint="Forward event risk"
        accent={exposure.earnings30dPct >= 40 ? 'critical' : 'default'}
      />
      <Stat
        label="Next critical"
        value={nextValue}
        hint={nextHint}
        accent="accent"
      />
    </div>
  )
}
