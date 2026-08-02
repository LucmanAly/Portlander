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

export function NeedsAttention({ events }: { events: ScoredEvent[] }) {
  if (events.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink-450">Needs attention</h2>
      <div className="surface divide-y divide-border overflow-hidden rounded-2xl">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={e.eventType} />
                <span className="truncate text-sm font-medium text-ink-100">
                  {e.ticker ? `${e.ticker} · ${e.title}` : e.title}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-450">{formatEventDay(e.eventDate)}</p>
            </div>
            <div className="tabular shrink-0 text-right text-sm font-semibold text-ink-100">
              {formatPct(e.positionWeightPct)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
