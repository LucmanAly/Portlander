import { addDays, format, nextWednesday, setDate, startOfMonth } from 'date-fns'
import type { PortfolioEvent } from '@/types'

/**
 * Seed approximate macro dates for the next ~90 days.
 * Phase 1: static heuristic seed — replace with official calendar later.
 */
export function buildMacroSeed(from = new Date()): PortfolioEvent[] {
  const events: PortfolioEvent[] = []
  const start = from

  // Rough FOMC-style Wednesdays every ~6 weeks from a near Wednesday
  let fomc = nextWednesday(start)
  if (fomc < start) fomc = addDays(fomc, 7)
  for (let i = 0; i < 3; i++) {
    const date = addDays(fomc, i * 42)
    events.push({
      id: `macro-fomc-${format(date, 'yyyy-MM-dd')}`,
      ticker: null,
      title: 'FOMC decision',
      eventType: 'fomc',
      eventDate: format(date, 'yyyy-MM-dd'),
      timing: 'unknown',
      status: 'estimated',
      source: 'macro-seed',
      description: 'Federal Reserve rate decision / statement',
    })
  }

  // CPI ~ mid-month (13th) next 3 months
  for (let m = 0; m < 3; m++) {
    const month = startOfMonth(addDays(start, m * 32))
    const cpiDate = setDate(month, 13)
    if (cpiDate < start) continue
    events.push({
      id: `macro-cpi-${format(cpiDate, 'yyyy-MM-dd')}`,
      ticker: null,
      title: 'CPI release',
      eventType: 'cpi',
      eventDate: format(cpiDate, 'yyyy-MM-dd'),
      timing: 'bmo',
      status: 'estimated',
      source: 'macro-seed',
    })
  }

  // NFP first Friday approximation — use day 5–8 window first Friday-like
  for (let m = 0; m < 3; m++) {
    const month = startOfMonth(addDays(start, m * 32))
    let nfp = setDate(month, 1)
    while (nfp.getDay() !== 5) {
      nfp = addDays(nfp, 1)
    }
    // first Friday
    if (nfp < start) continue
    events.push({
      id: `macro-nfp-${format(nfp, 'yyyy-MM-dd')}`,
      ticker: null,
      title: 'Nonfarm payrolls',
      eventType: 'nfp',
      eventDate: format(nfp, 'yyyy-MM-dd'),
      timing: 'bmo',
      status: 'estimated',
      source: 'macro-seed',
    })
  }

  return events
}

export const MACRO_EVENTS: PortfolioEvent[] = buildMacroSeed()
