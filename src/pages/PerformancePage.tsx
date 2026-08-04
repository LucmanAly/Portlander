import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { PerformanceSummaryCard } from '@/components/performance/PerformanceSummaryCard'
import { usePortfolio } from '@/context/PortfolioContext'
import { liveDailyPerformance, newYorkMarketDate } from '@/lib/performance'
import {
  generatePerformanceNarrative,
  loadSnapshotPerformance,
} from '@/lib/performanceRepository'
import type { GeneratedPerformanceNarrative, PerformanceSummary } from '@/types/performance'

export function PerformancePage() {
  const { user, backend, holdings, quotesLastSyncedAt, updateHolding } = usePortfolio()
  const today = newYorkMarketDate(new Date())
  const [startDate, setStartDate] = useState(format(subDays(parseISO(today), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(today)
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [narrative, setNarrative] = useState<GeneratedPerformanceNarrative | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftTags, setDraftTags] = useState<Record<string, string>>(() =>
    Object.fromEntries(holdings.map((holding) => [holding.id, (holding.tags ?? []).join(', ')])),
  )

  const liveToday = useMemo(
    () =>
      backend !== 'supabase' ||
      (quotesLastSyncedAt && newYorkMarketDate(quotesLastSyncedAt) === today)
        ? liveDailyPerformance(holdings, today)
        : null,
    [backend, holdings, quotesLastSyncedAt, today],
  )
  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [holdings],
  )

  useEffect(() => {
    setDraftTags((current) => ({
      ...Object.fromEntries(holdings.map((holding) => [holding.id, (holding.tags ?? []).join(', ')])),
      ...current,
    }))
  }, [holdings])

  const load = useCallback(async (from: string, to: string) => {
    if (from > to) {
      setError('Start date must be on or before end date.')
      return
    }
    setLoading(true)
    setError(null)
    setNarrative(null)
    try {
      if (backend !== 'supabase' || !user) {
        const local = from === today && to === today ? liveToday : null
        setSummary(local)
        if (!local) setError('Sign in to review stored portfolio history.')
        return
      }
      const result = await loadSnapshotPerformance(user.id, from, to, holdings)
      if (result.error) setError(result.error)
      setSummary(
        result.summary?.coverage === 'unavailable' && from === today && to === today
          ? liveToday
          : result.summary,
      )
    } finally {
      setLoading(false)
    }
  }, [backend, holdings, liveToday, today, user])

  useEffect(() => {
    void load(startDate, endDate)
    // Initial range load only; the form owns later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!summary || summary.coverage !== 'complete' || backend !== 'supabase') return
    void generatePerformanceNarrative(summary).then((result) => {
      if (!cancelled && result.narrative) setNarrative(result.narrative)
    })
    return () => {
      cancelled = true
    }
  }, [backend, summary])

  function submit(event: FormEvent) {
    event.preventDefault()
    void load(startDate, endDate)
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
          Portfolio history
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Period review</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-400">
          Choose any two dates to see market-driven portfolio movement, the holdings and themes that
          contributed most, and a separately labeled generated interpretation.
        </p>
      </header>

      <form onSubmit={submit} className="surface-elevated grid gap-4 rounded-2xl p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1.5 text-sm text-ink-300">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="space-y-1.5 text-sm text-ink-300">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(event) => setEndDate(event.target.value)}
            className="input w-full"
          />
        </label>
        <button type="submit" className="focus-ring min-h-11 rounded-xl bg-accent-500 px-5 text-sm font-semibold text-ink-950 hover:bg-accent-400">
          Analyze period
        </button>
      </form>

      <PerformanceSummaryCard
        title={`${startDate} to ${endDate}`}
        summary={summary}
        narrative={narrative}
        loading={loading}
        error={error}
        showReviewLink={false}
      />

      {summary && summary.limitations.length > 1 ? (
        <section className="surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink-200">How to read this</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-450">
            {summary.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </section>
      ) : null}

      <details className="surface rounded-2xl p-5">
        <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-ink-200">
          Manage theme tags
        </summary>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-ink-450">
          Tags are the source of truth for custom groupings. Use labels such as{' '}
          <code className="text-ink-300">cyber</code>, <code className="text-ink-300">quantum</code>,
          or <code className="text-ink-300">crypto</code>. DeepSeek does not classify holdings or
          change these tags.
        </p>
        <div className="mt-4 divide-y divide-border">
          {sortedHoldings.map((holding) => (
            <form
              key={holding.id}
              className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr_auto] sm:items-center"
              onSubmit={(event) => {
                event.preventDefault()
                const tags = (draftTags[holding.id] ?? '')
                  .split(',')
                  .map((tag) => tag.trim().toLowerCase())
                  .filter(Boolean)
                updateHolding(holding.id, { tags: [...new Set(tags)] })
              }}
            >
              <span className="font-mono text-sm font-semibold text-ink-100">{holding.ticker}</span>
              <input
                value={draftTags[holding.id] ?? ''}
                onChange={(event) =>
                  setDraftTags((current) => ({ ...current, [holding.id]: event.target.value }))
                }
                placeholder="cyber, core"
                aria-label={`${holding.ticker} theme tags`}
                className="input w-full"
              />
              <button type="submit" className="focus-ring min-h-11 rounded-xl bg-ink-800 px-4 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750">
                Save
              </button>
            </form>
          ))}
        </div>
      </details>
    </div>
  )
}
