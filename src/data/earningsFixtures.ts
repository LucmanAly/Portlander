import type { PortfolioEvent } from '@/types'
import type { EarningsFacts, GeneratedInterpretation } from '@/types/earnings'

/**
 * Typed fixture data for the event-intelligence UI (UX-02 onward).
 *
 * As of BE-01–BE-05, this is unit-test fixture data only — Today's deck and
 * the Earnings workspace (`buildEarningsCards` in `src/lib/earningsIntel.ts`)
 * read real consensus/actual/surprise/history from each event's own stored
 * Finnhub payload and never fall back to a ticker-matched entry here. That
 * fallback was retired in BE-05: a real AAPL or META holding must not get
 * decorated with these demo numbers just because the ticker happens to
 * collide with one of the 8 states below. `EarningsReportCard.test.tsx`,
 * `EarningsDetailDrawer.test.tsx`, and `EarningsDeck.test.tsx` read this file
 * directly (via `buildEarningsCardModel`, not `buildEarningsCards`) to cover
 * all 8 states without needing a live sync — keep it around for that, but
 * don't wire it back into the production data path.
 *
 * Revenue/EPS are stored as raw numbers (not pre-formatted strings), matching
 * what a real provider returns.
 */

/** Fixed reference date so fixture-driven tests never depend on the wall clock. */
export const FIXTURE_TODAY = new Date(2026, 7, 2) // 2026-08-02, local midnight

export const EARNINGS_FIXTURES: Record<string, EarningsFacts & { interpretation?: GeneratedInterpretation }> = {
  // 1. Fully-populated reported: positive surprise, guidance raised, reaction up, 4/4 beat history, interpretation.
  AAPL: {
    consensus: { epsEstimate: 1.5, revenueEstimate: 94_500_000_000, epsEstimateCount: 24, revenueEstimateCount: 18 },
    actual: { epsActual: 1.64, revenueActual: 96_200_000_000 },
    surprise: { epsSurprisePct: 9.3, epsSurpriseAbs: 0.14, revenueSurprisePct: 1.8, revenueSurpriseAbs: 1_700_000_000 },
    guidance: { direction: 'raised', note: 'Services growth guided up for next quarter' },
    reaction: { direction: 'up', pricePct: 3.2, asOf: '2026-07-31T20:00:00Z' },
    provenance: { source: 'Finnhub', fetchedAt: '2026-07-31T21:00:00Z' },
    history: [
      { quarter: 'Q2 2026', epsBeat: true, revenueBeat: true },
      { quarter: 'Q1 2026', epsBeat: true, revenueBeat: true },
      { quarter: 'Q4 2025', epsBeat: true, revenueBeat: true },
      { quarter: 'Q3 2025', epsBeat: true, revenueBeat: true },
    ],
    interpretation: {
      summary:
        'Beat on both lines with services strength driving the upside; management raised forward guidance, which the market read positively.',
      model: 'deepseek-v3',
      generatedAt: '2026-07-31T21:05:00Z',
      confidence: 'medium',
    },
  },

  // 2. Reported, mixed EPS beat / revenue miss, guidance maintained, reaction flat, 2-of-4 known beat history.
  TSLA: {
    consensus: { epsEstimate: 0.72, revenueEstimate: 25_800_000_000 },
    actual: { epsActual: 0.81, revenueActual: 25_100_000_000 },
    surprise: { epsSurprisePct: 12.5, epsSurpriseAbs: 0.09, revenueSurprisePct: -2.7, revenueSurpriseAbs: -700_000_000 },
    guidance: { direction: 'maintained' },
    reaction: { direction: 'flat', pricePct: 0.4, asOf: '2026-07-30T20:00:00Z' },
    provenance: { source: 'Finnhub', fetchedAt: '2026-07-30T21:00:00Z' },
    history: [
      { quarter: 'Q2 2026', epsBeat: true, revenueBeat: false },
      { quarter: 'Q1 2026', epsBeat: false, revenueBeat: false },
      { quarter: 'Q4 2025', epsBeat: null, revenueBeat: null },
      { quarter: 'Q3 2025', epsBeat: null, revenueBeat: null },
    ],
  },

  // 3. Awaiting results: consensus only, no actual/surprise/guidance/reaction/interpretation yet.
  NVDA: {
    consensus: { epsEstimate: 0.98, revenueEstimate: 42_300_000_000, epsEstimateCount: 31, revenueEstimateCount: 22 },
    provenance: { source: 'Finnhub', fetchedAt: '2026-08-01T12:00:00Z' },
  },

  // 4. Upcoming, consensus present, empty history (recent-IPO case).
  RIVN: {
    consensus: { epsEstimate: -0.35, revenueEstimate: 1_200_000_000 },
    provenance: { source: 'Finnhub', fetchedAt: '2026-08-01T12:00:00Z' },
    history: [],
  },

  // 5. Upcoming, no consensus at all (provider hasn't published estimates).
  ARM: {
    provenance: { source: 'Finnhub', fetchedAt: '2026-08-01T12:00:00Z' },
  },

  // 6. Reported, actual present but no surprise (no consensus baseline to diff against).
  GOOGL: {
    actual: { epsActual: 2.1, revenueActual: 88_400_000_000 },
    provenance: { source: 'Finnhub', fetchedAt: '2026-08-01T21:00:00Z' },
    history: [{ quarter: 'Q2 2026', epsBeat: null, revenueBeat: null }],
  },

  // 7. Reported, guidance withdrawn (rare enum branch).
  META: {
    consensus: { epsEstimate: 5.4, revenueEstimate: 41_000_000_000 },
    actual: { epsActual: 5.1, revenueActual: 40_200_000_000 },
    surprise: { epsSurprisePct: -5.6, epsSurpriseAbs: -0.3, revenueSurprisePct: -2.0, revenueSurpriseAbs: -800_000_000 },
    guidance: { direction: 'withdrawn', note: 'Regulatory review cited as the reason' },
    reaction: { direction: 'down', pricePct: -4.1, asOf: '2026-07-30T20:00:00Z' },
    provenance: { source: 'Finnhub', fetchedAt: '2026-07-30T21:00:00Z' },
    history: [{ quarter: 'Q2 2026', epsBeat: false, revenueBeat: false }],
  },

  // 8. Reported, provenance.isEstimateFallback true (freshness-fallback visual treatment).
  AMZN: {
    consensus: { epsEstimate: 1.1, revenueEstimate: 158_000_000_000 },
    actual: { epsActual: 1.22, revenueActual: 161_500_000_000 },
    surprise: { epsSurprisePct: 10.9, epsSurpriseAbs: 0.12, revenueSurprisePct: 2.2, revenueSurpriseAbs: 3_500_000_000 },
    guidance: { direction: 'raised' },
    reaction: { direction: 'up', pricePct: 5.0, asOf: '2026-07-31T20:00:00Z' },
    provenance: { source: 'Finnhub (cached)', fetchedAt: '2026-07-29T21:00:00Z', isEstimateFallback: true },
    history: [{ quarter: 'Q2 2026', epsBeat: true, revenueBeat: true }],
  },
}

function earningsEvent(
  ticker: string,
  company: string,
  eventDate: string,
  timing: PortfolioEvent['timing'],
  status: PortfolioEvent['status'],
): PortfolioEvent {
  return {
    id: `fixture-${ticker}-${eventDate}`,
    ticker,
    title: `${company} earnings`,
    eventType: 'earnings',
    eventDate,
    timing,
    status,
    source: 'fixture',
  }
}

/** Paired synthetic events spanning roughly D-3..D+10 relative to FIXTURE_TODAY (2026-08-02). */
export const EARNINGS_FIXTURE_EVENTS: PortfolioEvent[] = [
  earningsEvent('META', 'Meta Platforms', '2026-07-30', 'amc', 'confirmed'), // D-3, reported
  earningsEvent('TSLA', 'Tesla', '2026-07-31', 'amc', 'confirmed'), // D-2, reported
  earningsEvent('AAPL', 'Apple', '2026-07-31', 'amc', 'confirmed'), // D-2, reported
  earningsEvent('AMZN', 'Amazon', '2026-08-01', 'amc', 'confirmed'), // D-1, reported
  earningsEvent('GOOGL', 'Alphabet', '2026-08-01', 'bmo', 'confirmed'), // D-1, reported
  earningsEvent('NVDA', 'NVIDIA', '2026-08-02', 'amc', 'estimated'), // D0, awaiting
  earningsEvent('RIVN', 'Rivian', '2026-08-05', 'bmo', 'estimated'), // D+3, upcoming
  earningsEvent('ARM', 'Arm Holdings', '2026-08-12', 'amc', 'estimated'), // D+10, upcoming
]
