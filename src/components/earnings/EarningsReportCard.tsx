import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { EarningsCardModel } from '@/types/earnings'
import { EarningsStateBadge, TimingBadge } from '@/components/ui/Badge'
import { MetricPair } from '@/components/ui/MetricPair'
import { FreshnessLabel } from '@/components/ui/FreshnessLabel'
import { HistoricalBeatStrip } from '@/components/earnings/HistoricalBeatStrip'
import { formatEps, formatCompactMoney, formatEventDay, formatPct, formatSignedPct } from '@/lib/format'

/**
 * Renders an EarningsCardModel. Deliberately does NOT render `card.interpretation`
 * itself — callers (e.g. the UX-05 detail drawer) compose GeneratedInsight into the
 * `children` slot below a divider, so the verified card body is structurally
 * incapable of blending generated content.
 */
export function EarningsReportCard({
  card,
  variant = 'compact',
  selected = false,
  onSelect,
  children,
}: {
  card: EarningsCardModel
  variant?: 'hero' | 'compact'
  selected?: boolean
  onSelect?: () => void
  children?: ReactNode
}) {
  const facts = card.facts
  const isHero = variant === 'hero'
  const isReported = card.viewState === 'reported'

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <EarningsStateBadge state={card.viewState} />
            <TimingBadge timing={card.timing} />
            {card.isWatchlist ? (
              <span className="inline-flex items-center rounded-md border border-border bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium text-ink-400">
                Watchlist
              </span>
            ) : null}
          </div>
          <div className={clsx('mt-2 flex items-baseline gap-2', isHero ? 'text-lg' : 'text-base')}>
            <span className="font-semibold text-accent-400">{card.ticker}</span>
            <span className="truncate text-ink-300">{card.companyName ?? card.title}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{formatEventDay(card.eventDate)}</p>
        </div>

        {card.isHolding ? (
          <div className="shrink-0 text-right">
            <div className={clsx('tabular font-semibold text-ink-100', isHero ? 'text-3xl' : 'text-xl')}>
              {formatPct(card.positionWeightPct)}
            </div>
            <div className="text-[11px] text-ink-500">Portfolio</div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-border/60 border-t border-border/60">
        <MetricPair
          label="EPS"
          estimate={facts?.consensus?.epsEstimate}
          actual={isReported ? facts?.actual?.epsActual : undefined}
          format={formatEps}
        />
        <MetricPair
          label="Revenue"
          estimate={facts?.consensus?.revenueEstimate}
          actual={isReported ? facts?.actual?.revenueActual : undefined}
          format={formatCompactMoney}
        />
      </div>

      {isReported && facts?.surprise ? (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {facts.surprise.epsSurprisePct != null ? (
            <span
              className={clsx(
                'font-medium',
                facts.surprise.epsSurprisePct >= 0 ? 'text-positive' : 'text-critical',
              )}
            >
              EPS {formatSignedPct(facts.surprise.epsSurprisePct)} surprise
            </span>
          ) : null}
          {facts.surprise.revenueSurprisePct != null ? (
            <span
              className={clsx(
                'font-medium',
                facts.surprise.revenueSurprisePct >= 0 ? 'text-positive' : 'text-critical',
              )}
            >
              Rev {formatSignedPct(facts.surprise.revenueSurprisePct)} surprise
            </span>
          ) : null}
        </div>
      ) : null}

      {isReported && facts?.guidance && facts.guidance.direction !== 'none' ? (
        <p className="mt-2 text-xs text-ink-400">
          Guidance: <span className="font-medium text-ink-200">{facts.guidance.direction}</span>
          {facts.guidance.note ? ` — ${facts.guidance.note}` : ''}
        </p>
      ) : null}

      {isReported && facts?.reaction ? (
        <p className="mt-1 text-xs text-ink-400">
          Reaction:{' '}
          <span
            className={clsx(
              'font-medium',
              facts.reaction.direction === 'up' && 'text-positive',
              facts.reaction.direction === 'down' && 'text-critical',
              facts.reaction.direction === 'flat' && 'text-ink-300',
            )}
          >
            {facts.reaction.direction}
            {facts.reaction.pricePct != null ? ` ${formatSignedPct(facts.reaction.pricePct)}` : ''}
          </span>
        </p>
      ) : null}

      {isHero ? (
        <div className="mt-3">
          <HistoricalBeatStrip history={facts?.history} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <FreshnessLabel provenance={facts?.provenance} />
      </div>

      {children}
    </>
  )

  if (!onSelect) {
    return (
      <article className={clsx('surface-elevated rounded-xl p-4', isHero && 'p-5')}>
        {content}
      </article>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'focus-ring surface-elevated w-full rounded-xl p-4 text-left transition hover:border-border-strong',
        isHero && 'p-5',
        selected && 'ring-1 ring-accent-500/50',
      )}
    >
      {content}
    </button>
  )
}
