import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ScoredEvent } from '@/types'
import { scoreTier, sortEventsByImpact } from '@/lib/scoring'
import { formatEventDay, formatPct } from '@/lib/format'
import { TypeBadge } from '@/components/ui/Badge'

const MAX_ITEMS = 5

/** High-impact events you're actually holding — everything else can wait for Earnings/Calendar. */
export function needsAttentionEvents(events: ScoredEvent[]): ScoredEvent[] {
  return sortEventsByImpact(
    events.filter((e) => e.isHolding && scoreTier(e.impactScore) === 'high'),
  ).slice(0, MAX_ITEMS)
}

/** Earnings rows deep-link into the workspace's detail drawer; everything else opens the day on Calendar. */
function eventHref(e: ScoredEvent): string {
  if (e.eventType === 'earnings' && e.ticker) {
    return `/earnings?ticker=${encodeURIComponent(e.ticker)}`
  }
  return `/calendar?date=${e.eventDate}`
}

export function NeedsAttention({ events }: { events: ScoredEvent[] }) {
  if (events.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink-450">Needs attention</h2>
      <div className="surface divide-y divide-border overflow-hidden rounded-2xl">
        {events.map((e) => (
          <Link
            key={e.id}
            to={eventHref(e)}
            className="focus-ring flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-ink-800/40 active:bg-ink-800/60"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={e.eventType} />
                <span className="truncate text-sm font-medium text-ink-100">
                  {e.ticker ? `${e.ticker} · ${e.title}` : e.title}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-450">{formatEventDay(e.eventDate)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="tabular text-right text-sm font-semibold text-ink-100">
                {formatPct(e.positionWeightPct)}
              </div>
              <ChevronRight className="h-4 w-4 text-ink-450" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
