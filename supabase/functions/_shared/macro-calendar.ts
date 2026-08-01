/**
 * Portlander — shared macro calendar table
 *
 * Real, officially published FOMC / CPI / NFP dates only. Nothing here is
 * computed or extrapolated — every row traces to a primary-source release:
 *
 *   FOMC — federalreserve.gov/monetarypolicy/fomccalendars.htm. The Fed
 *     publishes each year's schedule roughly a year ahead and explicitly
 *     labels the *following* year's dates "tentative" until confirmed
 *     meeting-by-meeting; those rows carry status 'estimated' here, current-
 *     year rows carry 'confirmed'.
 *   CPI / NFP (Employment Situation) — bls.gov/schedule. BLS publishes the
 *     full-year release calendar in advance; dates can still shift (e.g. a
 *     government shutdown), so treat this table as "best known as of the
 *     compiled-on date below", not immutable.
 *
 * Compiled 2026-08-01. When it goes stale, extend the arrays below from the
 * primary sources above — do not derive new dates by pattern-matching the
 * existing ones (that's the bug this file replaces: see buildMacroEvents()
 * in sync-events' git history). An empty/short table beyond the published
 * horizon is correct behavior, not a bug.
 */

export type MacroEventType = 'fomc' | 'cpi' | 'nfp'
export type MacroTiming = 'bmo' | 'amc' | 'unknown'
export type MacroStatus = 'confirmed' | 'estimated'

export interface MacroCalendarEntry {
  eventType: MacroEventType
  /** ISO yyyy-mm-dd */
  eventDate: string
  title: string
  description: string
  timing: MacroTiming
  status: MacroStatus
}

export const MACRO_CALENDAR: MacroCalendarEntry[] = [
  // FOMC decision dates (second day of each two-day meeting).
  // 2026: confirmed schedule, announced 2024-08-09.
  {
    eventType: 'fomc',
    eventDate: '2026-09-16',
    title: 'FOMC decision',
    description: 'Federal Reserve rate decision / statement (Sept 15-16, 2026 meeting)',
    timing: 'unknown',
    status: 'confirmed',
  },
  {
    eventType: 'fomc',
    eventDate: '2026-10-28',
    title: 'FOMC decision',
    description: 'Federal Reserve rate decision / statement (Oct 27-28, 2026 meeting)',
    timing: 'unknown',
    status: 'confirmed',
  },
  {
    eventType: 'fomc',
    eventDate: '2026-12-09',
    title: 'FOMC decision',
    description: 'Federal Reserve rate decision / statement (Dec 8-9, 2026 meeting)',
    timing: 'unknown',
    status: 'confirmed',
  },
  // 2027: tentative schedule, announced 2025-09-05 — not yet reconfirmed.
  {
    eventType: 'fomc',
    eventDate: '2027-01-27',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Jan 26-27, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-03-17',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Mar 16-17, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-04-28',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Apr 27-28, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-06-09',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Jun 8-9, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-07-28',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Jul 27-28, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-09-15',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Sep 14-15, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-10-27',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Oct 26-27, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },
  {
    eventType: 'fomc',
    eventDate: '2027-12-08',
    title: 'FOMC decision (tentative)',
    description: 'Federal Reserve rate decision / statement (Dec 7-8, 2027 meeting, tentative)',
    timing: 'unknown',
    status: 'estimated',
  },

  // CPI release dates — BLS Schedule of Releases for the Consumer Price Index.
  {
    eventType: 'cpi',
    eventDate: '2026-08-12',
    title: 'CPI release',
    description: 'Consumer Price Index — July 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
  {
    eventType: 'cpi',
    eventDate: '2026-09-11',
    title: 'CPI release',
    description: 'Consumer Price Index — August 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },

  // NFP / Employment Situation release dates — BLS Schedule of Selected Releases.
  {
    eventType: 'nfp',
    eventDate: '2026-08-07',
    title: 'Nonfarm payrolls',
    description: 'US employment report — July 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
  {
    eventType: 'nfp',
    eventDate: '2026-09-04',
    title: 'Nonfarm payrolls',
    description: 'US employment report — August 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
  {
    eventType: 'nfp',
    eventDate: '2026-10-02',
    title: 'Nonfarm payrolls',
    description: 'US employment report — September 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
  {
    eventType: 'nfp',
    eventDate: '2026-11-06',
    title: 'Nonfarm payrolls',
    description: 'US employment report — October 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
  {
    eventType: 'nfp',
    eventDate: '2027-01-08',
    title: 'Nonfarm payrolls',
    description: 'US employment report — December 2026 data',
    timing: 'bmo',
    status: 'confirmed',
  },
]
