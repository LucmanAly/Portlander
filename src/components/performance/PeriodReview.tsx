import { useState, type FormEvent } from 'react'
import { format, subDays } from 'date-fns'
import { CalendarRange } from 'lucide-react'
import { usePortfolio } from '@/context/PortfolioContext'
import { buildSnapshotSummary } from '@/lib/performance'
import { loadPerformanceSnapshots } from '@/lib/portfolioRepository'
import { PerformanceRecapCard } from '@/components/performance/PerformanceRecapCard'
import type { PerformanceSummary } from '@/types/performance'

export function PeriodReview() {
  const { backend, user, holdings, updateHolding } = usePortfolio()
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [summary, setSummary] = useState<PerformanceSummary | undefined>()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Choose any period after snapshot collection began.')

  async function analyze(event: FormEvent) {
    event.preventDefault()
    if (startDate > endDate) {
      setSummary(undefined)
      setMessage('Start date must be on or before end date.')
      return
    }
    if (backend !== 'supabase' || !user) {
      setSummary(undefined)
      setMessage('Sign in to analyze saved portfolio history.')
      return
    }
    setLoading(true)
    const { snapshots, error } = await loadPerformanceSnapshots(startDate, endDate, user.id)
    const currentTags = new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding.tags ?? []]))
    const next = buildSnapshotSummary(snapshots, startDate, endDate, 'range', currentTags)
    setSummary(next)
    setMessage(
      error?.message ??
        (next
          ? `Using complete captures on ${next.effectiveStartDate} and ${next.effectiveEndDate}.`
          : 'No comparison yet. The selected range needs complete captures on at least two dates.'),
    )
    setLoading(false)
  }

  return (
    <section className="surface-elevated rounded-2xl p-5" aria-labelledby="period-review-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">Performance history</p>
          <h2 id="period-review-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink-100">
            <CalendarRange className="h-4 w-4 text-accent-400" aria-hidden="true" />
            Review a date range
          </h2>
          <p className="mt-1 text-sm text-ink-450">Verified value, ticker, and tagged-theme attribution first; generated interpretation stays separate.</p>
        </div>
        <form onSubmit={analyze} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-450">
            From
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-450">
            To
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </label>
          <button type="submit" disabled={loading} className="focus-ring rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-400 disabled:opacity-50">
            Analyze period
          </button>
        </form>
      </div>
      <p className="mt-3 text-xs text-ink-450">{message}</p>
      <details className="mt-3 rounded-xl bg-ink-900/35 p-3 ring-1 ring-border">
        <summary className="focus-ring cursor-pointer rounded-lg text-sm font-medium text-ink-300">Manage theme tags</summary>
        <p className="mt-2 text-xs text-ink-450">Use comma-separated themes such as cybersecurity, quantum, or crypto. Current tags classify both current and historical captures; overlapping tags are allowed.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {holdings.map((holding) => (
            <label key={holding.id} className="flex items-center gap-2 text-xs text-ink-300">
              <span className="w-14 shrink-0 font-semibold text-accent-400">{holding.ticker}</span>
              <input
                className="input min-w-0 flex-1"
                defaultValue={(holding.tags ?? []).join(', ')}
                placeholder="cybersecurity"
                onBlur={(event) => {
                  const tags = [...new Set(event.target.value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
                  if (tags.join('|') !== (holding.tags ?? []).join('|')) updateHolding(holding.id, { tags })
                }}
                aria-label={`${holding.ticker} theme tags`}
              />
            </label>
          ))}
        </div>
      </details>
      <div className="mt-4">
        <PerformanceRecapCard
          title="Selected-period recap"
          summary={summary}
          loading={loading}
          emptyMessage="Run the analysis after choosing a date range. Historical attribution begins with Portlander’s first complete saved capture; it is not reconstructed from guesses."
          enableNarrative={backend === 'supabase' && Boolean(user)}
        />
      </div>
    </section>
  )
}
