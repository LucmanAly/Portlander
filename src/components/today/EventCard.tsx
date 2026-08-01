import { StatusBadge, TierBadge, TimingBadge, TypeBadge } from '@/components/ui/Badge'
import { formatEventDay, formatMoney, formatPct } from '@/lib/format'
import { scoreTier } from '@/lib/scoring'
import type { ScoredEvent } from '@/types'

export function EventCard({ event }: { event: ScoredEvent }) {
  return (
    <article className="surface-elevated group rounded-xl p-4 transition duration-200 hover:border-border-strong">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={event.eventType} />
            <TimingBadge timing={event.timing} />
            <StatusBadge status={event.status} />
            <TierBadge tier={scoreTier(event.impactScore)} />
            {event.isWatchlist ? (
              <span className="rounded-md border border-border bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-400">
                Watchlist
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-ink-100">
              {event.ticker ? (
                <>
                  <span className="text-accent-400">{event.ticker}</span>
                  <span className="text-ink-500"> · </span>
                  <span className="font-medium text-ink-200">{event.title}</span>
                </>
              ) : (
                event.title
              )}
            </h3>
          </div>

          <p className="mt-1 text-sm text-ink-400">
            {formatEventDay(event.eventDate)}
            {event.isHolding ? (
              event.marketValue > 0 ? (
                <>
                  <span className="text-ink-600"> · </span>
                  <span className="tabular">{formatMoney(event.marketValue)}</span>
                </>
              ) : null
            ) : event.ticker ? (
              <span className="text-ink-500"> · Not held</span>
            ) : (
              <span className="text-ink-500"> · Macro · broad book impact</span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {event.isHolding ? (
            <>
              <div className="tabular text-3xl font-semibold tracking-tight text-ink-100">
                {formatPct(event.positionWeightPct)}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
                Portfolio
              </div>
            </>
          ) : (
            <div className="tabular text-sm text-ink-500">Impact {event.impactScore}</div>
          )}
        </div>
      </div>
    </article>
  )
}
