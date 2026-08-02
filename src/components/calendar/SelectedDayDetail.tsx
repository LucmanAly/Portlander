import type { ScoredEvent } from '@/types'
import { TypeBadge, TimingBadge } from '@/components/ui/Badge'
import { formatFullDate, formatPct } from '@/lib/format'

/**
 * Lives outside the calendar grid on purpose — per UX-06, cells stay scannable
 * dots/badges, and the full per-event detail (badges, weight, impact) shows
 * here instead of turning each cell into a miniature dashboard.
 */
export function SelectedDayDetail({
  dateKey,
  events,
}: {
  dateKey: string | null
  events: ScoredEvent[]
}) {
  if (!dateKey) {
    return (
      <div className="surface rounded-2xl px-4 py-6 text-center text-sm text-ink-450">
        Select a day on the calendar to see its events.
      </div>
    )
  }

  return (
    <div className="surface rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-ink-100">{formatFullDate(dateKey)}</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-ink-450">No events this day.</p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={e.eventType} />
                  <TimingBadge timing={e.timing} />
                </div>
                <p className="mt-1 truncate text-sm font-medium text-ink-100">
                  {e.ticker ? `${e.ticker} · ${e.title}` : e.title}
                </p>
              </div>
              <div className="tabular shrink-0 text-right text-sm">
                <div className="font-semibold text-ink-200">{e.impactScore}</div>
                {e.isHolding ? (
                  <div className="text-[11px] text-ink-450">{formatPct(e.positionWeightPct)}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
