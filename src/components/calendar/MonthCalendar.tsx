import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { PortfolioEvent } from '@/types'
import { isDividendType, isMacroType } from '@/lib/scoring'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function dayTone(events: PortfolioEvent[]): string {
  if (events.some((e) => e.eventType === 'earnings')) return 'bg-earnings-soft ring-1 ring-earnings/30'
  if (events.some((e) => isDividendType(e.eventType)))
    return 'bg-dividend-soft ring-1 ring-dividend/25'
  if (events.some((e) => isMacroType(e.eventType))) return 'bg-macro-soft ring-1 ring-macro/25'
  return ''
}

function dotColor(e: PortfolioEvent): string {
  if (e.eventType === 'earnings') return 'bg-earnings'
  if (isDividendType(e.eventType)) return 'bg-dividend'
  if (isMacroType(e.eventType)) return 'bg-macro'
  return 'bg-ink-500'
}

export function MonthCalendar({ events }: { events: PortfolioEvent[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const byDate = useMemo(() => {
    const map = new Map<string, PortfolioEvent[]>()
    for (const e of events) {
      const list = map.get(e.eventDate) ?? []
      list.push(e)
      map.set(e.eventDate, list)
    }
    return map
  }, [events])

  const today = new Date()

  return (
    <div className="surface-elevated rounded-2xl p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-ink-100">
          {format(cursor, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="focus-ring rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="focus-ring rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className="focus-ring rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-ink-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = byDate.get(key) ?? []
          const inMonth = isSameMonth(day, cursor)
          const isToday = isSameDay(day, today)

          return (
            <div
              key={key}
              className={clsx(
                'min-h-[88px] rounded-xl p-1.5 transition sm:min-h-[100px] sm:p-2',
                inMonth ? 'bg-ink-900/50' : 'bg-ink-950/40 opacity-40',
                dayTone(dayEvents),
                isToday && 'ring-1 ring-accent-500/50',
              )}
            >
              <div
                className={clsx(
                  'tabular mb-1 text-xs font-medium',
                  isToday ? 'text-accent-400' : 'text-ink-400',
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-ink-200"
                    title={e.title}
                  >
                    <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dotColor(e))} />
                    <span className="truncate">
                      {e.ticker ?? e.title.replace(' release', '').replace(' decision', '')}
                    </span>
                  </div>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="px-1 text-[10px] text-ink-500">+{dayEvents.length - 3}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-ink-500">
        <Legend color="bg-earnings" label="Earnings" />
        <Legend color="bg-dividend" label="Dividends" />
        <Legend color="bg-macro" label="Macro" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx('h-2 w-2 rounded-full', color)} />
      {label}
    </span>
  )
}
