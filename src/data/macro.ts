import { addDays, format } from 'date-fns'
import type { PortfolioEvent } from '@/types'

/**
 * Demo-only macro sample. The real calendar (production, signed-in users)
 * comes from supabase/functions/_shared/macro-calendar.ts, a hand-verified
 * table of officially published dates — not generated. This stays a small,
 * fixed sample so demo mode has something to show without pretending to be
 * a live feed.
 */
export function buildMacroSeed(from = new Date()): PortfolioEvent[] {
  const d = (offset: number) => format(addDays(from, offset), 'yyyy-MM-dd')

  return [
    {
      id: 'macro-demo-fomc',
      ticker: null,
      title: 'FOMC decision',
      eventType: 'fomc',
      eventDate: d(21),
      timing: 'unknown',
      status: 'estimated',
      source: 'macro-seed',
      description: 'Federal Reserve rate decision / statement (demo sample)',
    },
    {
      id: 'macro-demo-cpi',
      ticker: null,
      title: 'CPI release',
      eventType: 'cpi',
      eventDate: d(9),
      timing: 'bmo',
      status: 'estimated',
      source: 'macro-seed',
      description: 'Consumer Price Index (demo sample)',
    },
    {
      id: 'macro-demo-nfp',
      ticker: null,
      title: 'Nonfarm payrolls',
      eventType: 'nfp',
      eventDate: d(5),
      timing: 'bmo',
      status: 'estimated',
      source: 'macro-seed',
      description: 'US employment report (demo sample)',
    },
  ]
}

export const MACRO_EVENTS: PortfolioEvent[] = buildMacroSeed()
