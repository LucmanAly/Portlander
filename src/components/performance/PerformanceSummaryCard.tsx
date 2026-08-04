import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { formatMoney, formatSignedPct } from '@/lib/format'
import type { GeneratedPerformanceNarrative, PerformanceSummary } from '@/types/performance'

export function PerformanceSummaryCard({
  title,
  summary,
  narrative,
  loading = false,
  error,
  showReviewLink = true,
}: {
  title: string
  summary: PerformanceSummary | null
  narrative?: GeneratedPerformanceNarrative | null
  loading?: boolean
  error?: string | null
  showReviewLink?: boolean
}) {
  const total = summary?.totalPnlValue
  const tone = total == null ? 'text-ink-300' : total >= 0 ? 'text-positive' : 'text-critical'

  return (
    <section aria-labelledby="performance-briefing-title" className="surface-elevated rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
            Performance briefing
          </p>
          <h2 id="performance-briefing-title" className="mt-1 text-lg font-semibold text-ink-100">
            {title}
          </h2>
        </div>
        {showReviewLink ? (
          <Link
            to="/performance"
            className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-accent-400 hover:bg-ink-800"
          >
            Review a period <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-5 h-24 animate-pulse rounded-xl bg-ink-800" aria-label="Loading performance briefing" />
      ) : error ? (
        <p className="mt-4 rounded-xl bg-critical/10 p-3 text-sm text-critical">{error}</p>
      ) : !summary || summary.coverage === 'unavailable' ? (
        <div className="mt-4 rounded-xl bg-ink-850 p-4 ring-1 ring-border">
          <p className="text-sm font-medium text-ink-200">No complete snapshot for this period yet.</p>
          <p className="mt-1 text-xs leading-5 text-ink-450">
            Refreshing prices now records position-level history. Automatic after-close capture can
            fill this in each market day once its cron secret is configured.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={clsx('tabular text-2xl font-semibold', tone)}>
              {total == null ? 'Partial coverage' : `${total >= 0 ? '+' : ''}${formatMoney(total)}`}
            </span>
            {summary.totalReturnPct != null ? (
              <span className={clsx('tabular text-sm font-medium', tone)}>
                {formatSignedPct(summary.totalReturnPct)}
              </span>
            ) : null}
            <span className="text-xs text-ink-450">
              {summary.coveredDates.length} market {summary.coveredDates.length === 1 ? 'day' : 'days'} covered
              {summary.coverage === 'partial' ? ' · partial' : ''}
            </span>
          </div>

          {summary.themes.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {summary.themes.slice(0, 3).map((theme) => (
                <div key={theme.key} className="rounded-xl bg-ink-850 p-3 ring-1 ring-border">
                  <p className="truncate text-xs text-ink-450">{theme.label}</p>
                  <p
                    className={clsx(
                      'tabular mt-1 text-sm font-semibold',
                      theme.pnlValue >= 0 ? 'text-positive' : 'text-critical',
                    )}
                  >
                    {theme.pnlValue >= 0 ? '+' : ''}{formatMoney(theme.pnlValue)} · {formatSignedPct(theme.returnPct)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-ink-450">{theme.tickers.join(', ')}</p>
                </div>
              ))}
            </div>
          ) : null}

          {narrative ? (
            <div className="rounded-xl border border-accent-500/20 bg-accent-500/5 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> DeepSeek generated
              </p>
              <p className="mt-2 text-sm font-semibold text-ink-100">{narrative.headline}</p>
              <p className="mt-1 text-sm leading-6 text-ink-300">{narrative.summary}</p>
            </div>
          ) : null}

          {summary.limitations[0] ? (
            <p className="text-[11px] leading-5 text-ink-450">{summary.limitations[0]}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
