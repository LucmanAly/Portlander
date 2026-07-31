import { StatusBadge, TimingBadge, TypeBadge } from '@/components/ui/Badge'
import { formatEventDay, formatMoney, formatPct } from '@/lib/format'
import type { ScoredEvent } from '@/types'
import clsx from 'clsx'

export function EventCard({ event }: { event: ScoredEvent }) {
  const scoreTone =
    event.impactScore >= 70
      ? 'text-critical'
      : event.impactScore >= 45
        ? 'text-earnings'
        : 'text-ink-300'

  return (
    <article className="surface-elevated group rounded-xl p-4 transition duration-200 hover:border-border-strong">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={event.eventType} />
            <TimingBadge timing={event.timing} />
            <StatusBadge status={event.status} />
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
              <>
                <span className="text-ink-600"> · </span>
                <span className="tabular text-ink-300">
                  {formatPct(event.positionWeightPct)} portfolio
                </span>
                {event.marketValue > 0 ? (
                  <>
                    <span className="text-ink-600"> · </span>
                    <span className="tabular">{formatMoney(event.marketValue)}</span>
                  </>
                ) : null}
              </>
            ) : event.ticker ? (
              <span className="text-ink-500"> · Not held</span>
            ) : (
              <span className="text-ink-500"> · Macro · broad book impact</span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className={clsx('tabular text-3xl font-semibold tracking-tight', scoreTone)}>
            {event.impactScore}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Impact
          </div>
          <div
            className="mt-2 hidden text-[10px] leading-relaxed text-ink-500 sm:block"
            title="Impact = 65% weight + 25% type + 10% recency"
          >
            W{event.impactBreakdown.weightComponent} · T
            {event.impactBreakdown.typeComponent} · R
            {event.impactBreakdown.recencyComponent}
          </div>
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-800">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            event.impactScore >= 70
              ? 'bg-critical'
              : event.impactScore >= 45
                ? 'bg-earnings'
                : 'bg-accent-500',
          )}
          style={{ width: `${Math.min(100, event.impactScore)}%` }}
        />
      </div>
    </article>
  )
}
