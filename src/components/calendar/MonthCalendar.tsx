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
import type { ScoredEvent } from '@/types'
import { eventTypeLabel, isDividendType, isMacroType, scoreTier } from '@/lib/scoring'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Background tint only — kept separate from the ring so selection/today can't visually conflict with it (see dayRing). */
function dayBg(events: ScoredEvent[]): string {
  if (events.some((e) => e.eventType === 'earnings')) return 'bg-earnings-soft'
  if (events.some((e) => isDividendType(e.eventType))) return 'bg-dividend-soft'
  if (events.some((e) => isMacroType(e.eventType))) return 'bg-macro-soft'
  return ''
}

function dayEventTone(events: ScoredEvent[]): string {
  if (events.some((e) => e.eventType === 'earnings')) return 'ring-1 ring-earnings/30'
  if (events.some((e) => isDividendType(e.eventType))) return 'ring-1 ring-dividend/25'
  if (events.some((e) => isMacroType(e.eventType))) return 'ring-1 ring-macro/25'
  return ''
}

/**
 * Tailwind's ring-width/ring-color utilities all resolve to the same box-shadow
 * property, so stacking e.g. `ring-1 ring-earnings/30` with `ring-2 ring-accent-400`
 * on one element doesn't layer — one silently wins. Pick exactly one ring
 * treatment per cell instead, in priority order: selected > today > event tone.
 */
function dayRing(isSelected: boolean, isToday: boolean, events: ScoredEvent[]): string {
  if (isSelected) return 'ring-2 ring-accent-400'
  if (isToday) return 'ring-1 ring-accent-500/50'
  return dayEventTone(events)
}

function dotColor(e: ScoredEvent): string {
  if (e.eventType === 'earnings') return 'bg-earnings'
  if (isDividendType(e.eventType)) return 'bg-dividend'
  if (isMacroType(e.eventType)) return 'bg-macro'
  return 'bg-ink-500'
}

/**
 * Dot size scales with the position it's attached to, so the "position-weighted
 * calendar" the app's own docs describe actually encodes weight — previously
 * every dot was the same fixed size regardless of how much of the book an
 * event affected. Not held / macro events (0% weight) get the smallest dot.
 */
function dotSize(e: ScoredEvent): string {
  if (e.positionWeightPct >= 8) return 'h-2.5 w-2.5'
  if (e.positionWeightPct >= 3) return 'h-2 w-2'
  return 'h-1.5 w-1.5'
}

/** Earnings only: bright = reports before the open, dim = reports after the close. */
function timingTextTone(e: ScoredEvent): string {
  if (e.eventType !== 'earnings') return 'text-ink-200'
  if (e.timing === 'bmo') return 'text-ink-100'
  if (e.timing === 'amc') return 'text-ink-400'
  return 'text-ink-200'
}

/**
 * The dot conveys type (color) and weight (size) purely visually — this gives
 * screen-reader users the same two facts as text, so the dot itself can be
 * aria-hidden rather than silently conveying nothing.
 */
function eventRowLabel(e: ScoredEvent): string {
  const subject = e.ticker ? `${e.ticker} — ${e.title}` : e.title
  return `${eventTypeLabel(e.eventType)}: ${subject}, ${scoreTier(e.impactScore)} impact`
}

export function MonthCalendar({
  events,
  selectedDate,
  onSelectDay,
}: {
  events: ScoredEvent[]
  /** yyyy-MM-dd, controlled by the caller so a "selected day" panel can live outside the grid. */
  selectedDate?: string | null
  onSelectDay?: (dateKey: string) => void
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const byDate = useMemo(() => {
    const map = new Map<string, ScoredEvent[]>()
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-1 py-2 text-center text-xs font-medium text-ink-450">
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
          const isSelected = selectedDate === key
          const isCluster = dayEvents.length >= 2

          // Exactly one bg-* and one ring-* utility per cell — Tailwind's ring/bg
          // utilities all resolve to the same underlying property, so stacking
          // competing ones (e.g. bg-ink-900/50 + bg-earnings-soft) doesn't layer,
          // it silently picks one. See dayRing's comment for the same issue.
          const bgClassName = !inMonth ? 'bg-ink-950/40 opacity-40' : dayBg(dayEvents) || 'bg-ink-900/50'

          const cellClassName = clsx(
            'focus-ring relative min-h-[88px] rounded-xl p-1.5 text-left transition sm:min-h-[100px] sm:p-2',
            bgClassName,
            dayRing(isSelected, isToday, dayEvents),
            onSelectDay && 'cursor-pointer',
            // Same box-shadow-collision issue as dayRing: only add the hover ring
            // when nothing else is already claiming the ring, so hovering a
            // selected or today cell can't visually cancel that state.
            onSelectDay && !isSelected && !isToday && 'hover:ring-1 hover:ring-border-strong',
          )
          const ariaLabel = `${format(day, 'EEEE, MMMM d')}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ', no events'}`

          const cellContent = (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={clsx('tabular text-xs font-medium', isToday ? 'text-accent-400' : 'text-ink-400')}
                >
                  {format(day, 'd')}
                </span>
                {isCluster ? (
                  <span
                    className="rounded-full bg-ink-800 px-1 text-[9px] font-semibold text-ink-300"
                    title={`${dayEvents.length} reports this day`}
                  >
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:gap-0.5">
                {/* Below `sm` (roughly phone-portrait widths), a 7-column grid only
                    leaves ~25-30px per cell for the ticker once the dot and its gap
                    are accounted for — not enough room for a real ticker before
                    `truncate` clips it to one character. Stacking the ticker under
                    the dot instead of beside it gives it the full cell width. At
                    `sm` and up (landscape phones, tablets, desktop) there's enough
                    width for the original side-by-side row. */}
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex min-w-0 flex-col gap-0.5 rounded px-1 py-0.5 text-[10px] sm:flex-row sm:items-center sm:gap-1 sm:py-0"
                    title={e.title}
                    aria-label={eventRowLabel(e)}
                  >
                    <span className={clsx('shrink-0 rounded-full', dotSize(e), dotColor(e))} aria-hidden="true" />
                    <span className={clsx('min-w-0 truncate sm:flex-1', timingTextTone(e))}>
                      {e.ticker ?? e.title.replace(' release', '').replace(' decision', '')}
                    </span>
                  </div>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="px-1 text-[10px] text-ink-450">+{dayEvents.length - 3}</span>
                ) : null}
              </div>
            </>
          )

          if (!onSelectDay) {
            return (
              <div key={key} aria-label={ariaLabel} className={cellClassName}>
                {cellContent}
              </div>
            )
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-pressed={isSelected}
              aria-label={ariaLabel}
              className={cellClassName}
            >
              {cellContent}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-ink-450">
        <Legend color="bg-earnings" label="Earnings" />
        <Legend color="bg-dividend" label="Dividends" />
        <Legend color="bg-macro" label="Macro" />
      </div>
      <p className="mt-2 text-[11px] text-ink-600">
        Dot size tracks position weight · Earnings ticker:{' '}
        <span className="text-ink-100">bright</span> reports before the open ·{' '}
        <span className="text-ink-400">dim</span> reports after the close · number badge = multiple
        reports that day
      </p>
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
