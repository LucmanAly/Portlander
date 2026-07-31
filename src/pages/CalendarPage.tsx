import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { usePortfolio } from '@/context/PortfolioContext'
import { scoreAndFilterEvents } from '@/lib/scoring'
import { addDays, startOfDay, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { useMemo } from 'react'
import { formatPct } from '@/lib/format'
import { TypeBadge } from '@/components/ui/Badge'

export function CalendarPage() {
  const { events, holdings, watchlist, exposure } = usePortfolio()
  const today = startOfDay(new Date())

  const monthEvents = useMemo(() => {
    const from = startOfMonth(today)
    const to = endOfMonth(addMonths(today, 1))
    return events.filter((e) => e.eventDate >= formatYmd(from) && e.eventDate <= formatYmd(to))
  }, [events, today])

  const agenda = useMemo(
    () =>
      scoreAndFilterEvents(events, holdings, watchlist, {
        fromDate: today,
        toDate: addDays(today, 30),
        today,
      }).slice(0, 12),
    [events, holdings, watchlist, today],
  )

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
          Calendar
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Month view</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Color-coded by type. For ranked priority, use{' '}
          <span className="text-ink-200">Today</span>.{' '}
          <span className="tabular text-ink-300">{formatPct(exposure.earnings30dPct)}</span> of the
          book reports within 30 days.
        </p>
      </header>

      <MonthCalendar events={monthEvents} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
          Agenda · next 30 days
        </h2>
        <div className="surface divide-y divide-border overflow-hidden rounded-2xl">
          {agenda.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">No upcoming events.</p>
          ) : (
            agenda.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-800/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={e.eventType} />
                    <span className="truncate text-sm font-medium text-ink-100">
                      {e.ticker ? `${e.ticker} · ${e.title}` : e.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">{e.eventDate}</p>
                </div>
                <div className="tabular shrink-0 text-right text-sm">
                  <div className="font-semibold text-ink-200">{e.impactScore}</div>
                  {e.isHolding ? (
                    <div className="text-[11px] text-ink-500">
                      {formatPct(e.positionWeightPct)}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
