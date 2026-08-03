import { useEffect, useState } from 'react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import { formatMoney, formatPct } from '@/lib/format'
import { generatePerformanceNarrativeRemote } from '@/lib/portfolioRepository'
import { topAttribution } from '@/lib/performance'
import type { PerformanceAttribution, PerformanceNarrative, PerformanceSummary } from '@/types/performance'

export function PerformanceRecapCard({
  title,
  summary,
  loading = false,
  emptyMessage,
  enableNarrative,
}: {
  title: string
  summary?: PerformanceSummary
  loading?: boolean
  emptyMessage: string
  enableNarrative: boolean
}) {
  const [narrative, setNarrative] = useState<PerformanceNarrative | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setNarrative(null)
    setNarrativeError(null)
    setNarrativeLoading(false)
    if (!summary || !enableNarrative) return
    setNarrativeLoading(true)
    void generatePerformanceNarrativeRemote(summary).then(({ narrative: next, error }) => {
      if (cancelled) return
      setNarrative(next)
      setNarrativeError(error?.message ?? null)
      setNarrativeLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [summary, enableNarrative])

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-ink-850 ring-1 ring-border" aria-label="Loading performance recap" />
  }

  if (!summary) {
    return (
      <section className="surface rounded-2xl p-4" aria-label={title}>
        <p className="text-sm font-semibold text-ink-200">{title}</p>
        <p className="mt-1 text-sm text-ink-450">{emptyMessage}</p>
      </section>
    )
  }

  const tone = summary.valueChange >= 0 ? 'text-positive' : 'text-critical'
  const themes = topAttribution(summary.themeAttribution)
  const tickers = topAttribution(summary.tickerAttribution)

  return (
    <section className="surface rounded-2xl p-4" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-200">{title}</p>
          <p className="mt-0.5 text-xs text-ink-450">
            {summary.effectiveStartDate === summary.effectiveEndDate
              ? summary.effectiveEndDate
              : `${summary.effectiveStartDate} → ${summary.effectiveEndDate}`}
          </p>
        </div>
        <p className={clsx('tabular text-right text-base font-semibold', tone)}>
          {summary.valueChange >= 0 ? '+' : ''}{formatMoney(summary.valueChange)}
          <span className="ml-1 text-xs font-medium">
            ({summary.pctChange == null ? '—' : `${summary.pctChange >= 0 ? '+' : ''}${formatPct(summary.pctChange)}`})
          </span>
        </p>
      </div>

      {summary.hasPositionChanges ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-amber-400/8 p-3 text-xs text-amber-200 ring-1 ring-amber-400/20">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Position quantities changed. This is portfolio value change and may include trades or cash flows—not a cash-flow-adjusted return.
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AttributionList title="Theme contribution" items={themes} empty="Add holding tags to unlock theme attribution." />
        <AttributionList title="Largest position moves" items={tickers} empty="No material position moves." />
      </div>

      {themes.length > 0 && summary.overlappingThemes ? (
        <p className="mt-3 text-[11px] text-ink-450">Theme tags may overlap; theme rows are not intended to sum to the portfolio total.</p>
      ) : null}

      <div className="mt-4 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          DeepSeek summary · generated interpretation
        </p>
        {narrativeLoading ? <p className="mt-1 text-sm text-ink-450">Writing a grounded recap…</p> : null}
        {narrative ? (
          <div className="mt-1">
            <p className="text-sm font-medium text-ink-200">{narrative.headline}</p>
            <p className="mt-1 text-sm leading-6 text-ink-400">{narrative.narrative}</p>
          </div>
        ) : null}
        {!enableNarrative ? <p className="mt-1 text-sm text-ink-450">Sign in to generate and cache the qualitative recap.</p> : null}
        {narrativeError ? <p className="mt-1 text-xs text-ink-450">Generated summary unavailable. Verified figures above are unaffected.</p> : null}
      </div>
    </section>
  )
}

function AttributionList({
  title,
  items,
  empty,
}: {
  title: string
  items: PerformanceAttribution[]
  empty: string
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-450">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-ink-450">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink-300">{item.label}</span>
              <span className={clsx('tabular shrink-0 font-medium', item.valueChange >= 0 ? 'text-positive' : 'text-critical')}>
                {item.valueChange >= 0 ? '+' : ''}{formatMoney(item.valueChange)}
                {item.pctChange == null ? '' : ` · ${item.pctChange >= 0 ? '+' : ''}${formatPct(item.pctChange)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
