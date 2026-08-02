import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ScoredEvent } from '@/types'
import type { EarningsCardModel } from '@/types/earnings'
import { buildEarningsCards } from '@/lib/earningsIntel'

/**
 * Cards stay active from D-1 through D+1, sorted by impact. Callers should
 * already have scored a D-1..D+1, earnings-only window (see TodayPage), but
 * the day-window filter is re-applied here too — this is the one place the
 * "cards remain active from D-1 through D+1" rule is guaranteed to hold
 * regardless of what the caller passes.
 */
export function selectDeckCards(events: ScoredEvent[], today: Date = new Date()): EarningsCardModel[] {
  const inWindow = events.filter((e) => {
    const days = differenceInCalendarDays(parseISO(e.eventDate), today)
    return days >= -1 && days <= 1
  })

  return buildEarningsCards(inWindow, today)
}
