import { ExposureStrip } from '@/components/today/ExposureStrip'
import { EventCard } from '@/components/today/EventCard'
import { FilterBar } from '@/components/today/FilterBar'
import { OutlookToggle } from '@/components/today/OutlookToggle'
import { SortToggle, type SortMode } from '@/components/today/SortToggle'
import { usePortfolio } from '@/context/PortfolioContext'
import { formatRelativeSync } from '@/lib/format'
import { sortEventsByDate } from '@/lib/scoring'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export function TodayPage() {
  const {
    upcomingEvents,
    outlookDays,
    setOutlookDays,
    exposure,
    filter,
    setFilter,
    lastSyncAt,
    holdings,
  } = usePortfolio()
  const [sortMode, setSortMode] = useState<SortMode>('impact')

  const displayed = useMemo(
    () => (sortMode === 'date' ? sortEventsByDate(upcomingEvents) : upcomingEvents),
    [upcomingEvents, sortMode],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
            Portfolio radar
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">
            Your next {outlookDays} days
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-400">
            Events ranked by impact on <span className="text-ink-200">your</span> book — position
            weight, event type, and how soon they land.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OutlookToggle value={outlookDays} onChange={setOutlookDays} />
          <p className="text-xs text-ink-500">{formatRelativeSync(lastSyncAt)}</p>
        </div>
      </header>

      {holdings.length === 0 ? (
        <EmptyHoldings />
      ) : (
        <>
          <ExposureStrip exposure={exposure} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterBar value={filter} onChange={setFilter} />
            <div className="flex items-center gap-2.5">
              <p className="text-xs text-ink-500">
                <span className="tabular text-ink-300">{displayed.length}</span> events
              </p>
              <SortToggle value={sortMode} onChange={setSortMode} />
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="surface rounded-2xl px-6 py-12 text-center">
              <p className="text-ink-300">No events in the next {outlookDays} days for this filter.</p>
              <p className="mt-1 text-sm text-ink-500">
                Try All, or add tickers on the Portfolio page.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayed.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyHoldings() {
  return (
    <div className="surface-elevated rounded-2xl px-6 py-14 text-center">
      <h2 className="text-xl font-semibold text-ink-100">Add holdings to populate your radar</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
        Import a CSV or enter positions manually. Portlander will rank earnings and macro events by
        how much of your portfolio is on the line.
      </p>
      <Link
        to="/portfolio"
        className="focus-ring mt-6 inline-flex rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
      >
        Go to Portfolio
      </Link>
    </div>
  )
}
