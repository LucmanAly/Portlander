import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { SelectedDayDetail } from '@/components/calendar/SelectedDayDetail'
import { usePortfolio } from '@/context/PortfolioContext'
import { scoreAndFilterEvents, sortEventsByDate } from '@/lib/scoring'
import { addDays, format, startOfDay, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatEventDay, formatPct } from '@/lib/format'
import { TypeBadge } from '@/components/ui/Badge'
import { PillButton } from '@/components/ui/Button'

type MobileView = 'agenda' | 'month'

function exposureSentence(pct: number): string {
  if (pct >= 99.95) return 'All of your portfolio reports within 30 days.'
  if (pct <= 0.05) return 'None of your portfolio reports within 30 days.'
  return `${formatPct(pct)} of your portfolio reports within 30 days.`
}

export function CalendarPage() {
  const { events, holdings, watchlist, exposure } = usePortfolio()
  const today = startOfDay(new Date())
  const todayKey = format(today, 'yyyy-MM-dd')
  // Deep-link support: /calendar?date=2026-08-10 opens straight on that day,
  // so links from Today's "Needs attention" land on the relevant date
  // instead of a generic month view the user has to hunt through.
  const [searchParams] = useSearchParams()
  const [selectedDate, setSelectedDate] = useState<string | null>(() => searchParams.get('date'))
  // Grid + agenda list used to both render, stacked, on every screen size —
  // fine on desktop, a lot of redundant scrolling on a phone. Below `lg`,
  // show one or the other; agenda first since it's the format that already
  // shows full ticker names with no width constraint.
  const [mobileView, setMobileView] = useState<MobileView>('agenda')

  const monthEvents = useMemo(() => {
    const from = startOfMonth(today)
    const to = endOfMonth(addMonths(today, 1))
    // Scored, not raw, so the calendar's dots can encode position weight —
    // scoreAndFilterEvents already does the date-window filtering this used
    // to do by hand.
    return scoreAndFilterEvents(events, holdings, watchlist, { fromDate: from, toDate: to, today })
  }, [events, holdings, watchlist, today])

  const selectedDayEvents = useMemo(
    () => (selectedDate ? monthEvents.filter((e) => e.eventDate === selectedDate) : []),
    [monthEvents, selectedDate],
  )

  const agenda = useMemo(() => {
    const scored = scoreAndFilterEvents(events, holdings, watchlist, {
      fromDate: today,
      toDate: addDays(today, 30),
      today,
    })
    // Chronological, not impact-sorted — an "agenda" should walk the full 30-day
    // window in order rather than cut off at a fixed count (impact-desc + a small
    // slice used to silently hide most of days 15-30, since later events tend to
    // score lower on recency).
    return sortEventsByDate(scored)
  }, [events, holdings, watchlist, today])

  // Default selection: today if it has something reporting, otherwise the
  // next upcoming event — so the detail panel is never a dead "select a day"
  // prompt when there's an obvious answer. Only runs while nothing is
  // selected yet, so it won't fight a deep-link or a manual click.
  useEffect(() => {
    if (selectedDate) return
    if (monthEvents.some((e) => e.eventDate === todayKey)) {
      setSelectedDate(todayKey)
    } else if (agenda.length > 0) {
      setSelectedDate(agenda[0].eventDate)
    }
  }, [selectedDate, monthEvents, agenda, todayKey])

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
          Calendar
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Month view</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Color-coded by type. For ranked priority, use{' '}
          <span className="text-ink-200">Today</span>. {exposureSentence(exposure.earnings30dPct)}
        </p>
      </header>

      <div className="flex gap-1.5 lg:hidden">
        <PillButton size="sm" active={mobileView === 'agenda'} onClick={() => setMobileView('agenda')}>
          Agenda
        </PillButton>
        <PillButton size="sm" active={mobileView === 'month'} onClick={() => setMobileView('month')}>
          Month
        </PillButton>
      </div>

      <div className={mobileView === 'month' ? 'block lg:block' : 'hidden lg:block'}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <MonthCalendar events={monthEvents} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
          <SelectedDayDetail dateKey={selectedDate} events={selectedDayEvents} />
        </div>
      </div>

      <section className={mobileView === 'agenda' ? 'block lg:block' : 'hidden lg:block'}>
        <h2 className="mb-3 text-sm font-semibold text-ink-450">Agenda · next 30 days</h2>
        <div className="surface divide-y divide-border overflow-hidden rounded-2xl">
          {agenda.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-450">No upcoming events.</p>
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
                  <p className="mt-0.5 text-xs text-ink-450">{formatEventDay(e.eventDate)}</p>
                </div>
                <div className="tabular shrink-0 text-right text-sm">
                  <div className="font-semibold text-ink-200">{e.impactScore}</div>
                  {e.isHolding ? (
                    <div className="text-[11px] text-ink-450">
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
