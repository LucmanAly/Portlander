import { describe, expect, it } from 'vitest'
import {
  computeExposure,
  holdingMarketValue,
  isEstimatedValue,
  portfolioDayChange,
  portfolioDayChangePct,
  portfolioTotalGainLoss,
  portfolioTotalGainLossPct,
  portfolioTotalValue,
  portfolioWeightBasis,
  positionWeightPct,
  scoreAndFilterEvents,
  scoreEvent,
  scoreTier,
  weightAnchor,
} from '@/lib/scoring'
import type { Holding, PortfolioEvent } from '@/types'

const TODAY = new Date(2026, 7, 1) // 2026-08-01, local midnight

function holding(ticker: string, shares: number, lastPrice?: number, extra: Partial<Holding> = {}): Holding {
  return {
    id: `id-${ticker}`,
    ticker,
    shares,
    lastPrice,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function earnings(ticker: string, eventDate: string): PortfolioEvent {
  return {
    id: `ev-${ticker}-${eventDate}`,
    ticker,
    title: `${ticker} earnings`,
    eventType: 'earnings',
    eventDate,
    timing: 'amc',
    status: 'estimated',
    source: 'finnhub',
  }
}

describe('market value and weights', () => {
  it('uses last price when present', () => {
    expect(holdingMarketValue(holding('AAA', 10, 5))).toBe(50)
  })

  // Fixed in PR 6. Falling back to cost basis is still a real market value
  // (still used in totals/weights), but now flagged as estimated rather than
  // silently indistinguishable from an observed price.
  it('falls back to cost basis and flags the result as estimated', () => {
    const h = holding('AAA', 10, undefined, { costBasis: 4 })
    expect(holdingMarketValue(h)).toBe(40)
    expect(isEstimatedValue(h)).toBe(true)
    expect(isEstimatedValue(holding('AAA', 10, 5))).toBe(false)
  })

  it('treats a holding with neither price nor cost as worthless', () => {
    expect(holdingMarketValue(holding('AAA', 10))).toBe(0)
  })

  it('computes weight as a share of the portfolio total', () => {
    const book = [holding('AAA', 10, 10), holding('BBB', 10, 30)]
    const total = portfolioTotalValue(book)

    expect(total).toBe(400)
    expect(positionWeightPct(book[0], total)).toBe(25)
    expect(positionWeightPct(book[1], total)).toBe(75)
  })

  it('returns zero weight for an empty book rather than dividing by zero', () => {
    expect(positionWeightPct(holding('AAA', 10, 10), 0)).toBe(0)
  })

  it('clamps an override to 0–100', () => {
    const over = holding('AAA', 10, 10, { weightOverridePct: 140 })
    const under = holding('BBB', 10, 10, { weightOverridePct: -5 })

    expect(positionWeightPct(over, 1000)).toBe(100)
    expect(positionWeightPct(under, 1000)).toBe(0)
  })

  // Fixed in PR 6. positionWeightPct's computed branch now divides by
  // portfolioWeightBasis(), which scales down to leave exactly the room the
  // overrides don't already claim — so a mixed book sums to 100%.
  it('lets a mixed book sum to exactly 100%', () => {
    const book = [holding('AAA', 10, 10, { weightOverridePct: 90 }), holding('BBB', 10, 10)]
    const basis = portfolioWeightBasis(book)
    const sum = book.reduce((acc, h) => acc + positionWeightPct(h, basis), 0)

    expect(sum).toBeCloseTo(100, 5)
  })

  it('portfolioWeightBasis matches portfolioTotalValue when nothing is overridden', () => {
    const book = [holding('AAA', 10, 10), holding('BBB', 10, 30)]
    expect(portfolioWeightBasis(book)).toBe(portfolioTotalValue(book))
  })
})

describe('portfolio day change', () => {
  it('calculates the whole-book dollar and percentage move from the prior close', () => {
    const book = [
      holding('AAA', 10, 110, { dayChangeValue: 10 }),
      holding('BBB', 5, 50, { dayChangeValue: -2 }),
    ]

    expect(portfolioDayChange(book)).toBe(90)
    expect(portfolioDayChangePct(book)).toBeCloseTo((90 / 1260) * 100, 8)
  })

  it('does not report a partial refresh as a portfolio total', () => {
    const book = [
      holding('AAA', 10, 110, { dayChangeValue: 10 }),
      holding('BBB', 5, 50),
    ]

    expect(portfolioDayChange(book)).toBeUndefined()
    expect(portfolioDayChangePct(book)).toBeUndefined()
  })

  it('does not report a move for an empty book', () => {
    expect(portfolioDayChange([])).toBeUndefined()
    expect(portfolioDayChangePct([])).toBeUndefined()
  })
})

describe('portfolio total gain/loss', () => {
  it('calculates the whole-book unrealized gain/loss since cost basis', () => {
    const book = [
      holding('AAA', 10, 110, { costBasis: 100 }), // +100
      holding('BBB', 5, 40, { costBasis: 50 }), // -50
    ]

    expect(portfolioTotalGainLoss(book)).toBe(50)
    expect(portfolioTotalGainLossPct(book)).toBeCloseTo((50 / (10 * 100 + 5 * 50)) * 100, 8)
  })

  it('does not report a total when any position is missing cost basis (39/40-position book)', () => {
    const book = [holding('AAA', 10, 110, { costBasis: 100 }), holding('BBB', 5, 40)]
    expect(portfolioTotalGainLoss(book)).toBeUndefined()
    expect(portfolioTotalGainLossPct(book)).toBeUndefined()
  })

  it('does not report a total when any position is missing a live price', () => {
    const book = [holding('AAA', 10, undefined, { costBasis: 100 }), holding('BBB', 5, 40, { costBasis: 50 })]
    expect(portfolioTotalGainLoss(book)).toBeUndefined()
  })

  it('does not report a total for an empty book', () => {
    expect(portfolioTotalGainLoss([])).toBeUndefined()
    expect(portfolioTotalGainLossPct([])).toBeUndefined()
  })
})

describe('weightAnchor', () => {
  it('floors at 5% on a book with one dominant position and a long thin tail', () => {
    const book = [
      holding('BIG', 91, 1),
      ...Array.from({ length: 9 }, (_, i) => holding(`T${i}`, 1, 1)),
    ]
    const basis = portfolioWeightBasis(book)
    expect(weightAnchor(book, basis)).toBe(5)
  })

  it('scales up with a more spread-out book instead of staying fixed', () => {
    const flat = Array.from({ length: 10 }, (_, i) => holding(`T${i}`, 10, 1))
    const basis = portfolioWeightBasis(flat)
    expect(weightAnchor(flat, basis)).toBeGreaterThan(5)
  })
})

describe('scoreTier', () => {
  it('buckets into high/medium/low at the 70/45 boundaries', () => {
    expect(scoreTier(70)).toBe('high')
    expect(scoreTier(69)).toBe('medium')
    expect(scoreTier(45)).toBe('medium')
    expect(scoreTier(44)).toBe('low')
  })
})

describe('scoreEvent', () => {
  it('ranks a heavy position above a tiny one for the same event', () => {
    const book = [holding('BIG', 100, 100), holding('SMALL', 1, 100)]
    const total = portfolioTotalValue(book)

    const big = scoreEvent(earnings('BIG', '2026-08-04'), book, [], total, TODAY)
    const small = scoreEvent(earnings('SMALL', '2026-08-04'), book, [], total, TODAY)

    expect(big.impactScore).toBeGreaterThan(small.impactScore)
  })

  it('scores a nearer event above an identical distant one', () => {
    const book = [holding('AAA', 10, 100)]
    const total = portfolioTotalValue(book)

    const near = scoreEvent(earnings('AAA', '2026-08-01'), book, [], total, TODAY)
    const far = scoreEvent(earnings('AAA', '2026-09-15'), book, [], total, TODAY)

    expect(near.impactScore).toBeGreaterThan(far.impactScore)
  })

  it('gives a past event no recency credit', () => {
    const book = [holding('AAA', 10, 100)]
    const scored = scoreEvent(earnings('AAA', '2026-07-01'), book, [], 1000, TODAY)

    expect(scored.impactBreakdown.recencyComponent).toBe(0)
  })

  it('marks a watchlist-only ticker as watchlist, not holding', () => {
    const scored = scoreEvent(
      earnings('WATCH', '2026-08-04'),
      [],
      [{ id: 'w1', ticker: 'WATCH', createdAt: '2026-01-01T00:00:00.000Z' }],
      0,
      TODAY,
    )

    expect(scored.isWatchlist).toBe(true)
    expect(scored.isHolding).toBe(false)
    expect(scored.positionWeightPct).toBe(0)
  })

  // Fixed in PR 6. weightNorm now normalizes against a portfolio-relative
  // anchor (weightAnchor) instead of a fixed 20% clamp, so a 50% position
  // scores meaningfully higher than a 25% one instead of both maxing out.
  it('separates a 25% position from a 50% one', () => {
    const book = [holding('QUARTER', 25, 1), holding('HALF', 50, 1), holding('REST', 25, 1)]
    const total = portfolioTotalValue(book)

    const quarter = scoreEvent(earnings('QUARTER', '2026-08-04'), book, [], total, TODAY)
    const half = scoreEvent(earnings('HALF', '2026-08-04'), book, [], total, TODAY)

    expect(half.impactScore).toBeGreaterThan(quarter.impactScore)
  })

  it('breaks the score into components that sum to it', () => {
    const book = [holding('AAA', 10, 100)]
    const scored = scoreEvent(earnings('AAA', '2026-08-04'), book, [], 1000, TODAY)
    const { weightComponent, typeComponent, recencyComponent } = scored.impactBreakdown

    expect(weightComponent + typeComponent + recencyComponent).toBeCloseTo(scored.impactScore, 0)
  })
})

/**
 * The calibration problem, pinned with numbers.
 *
 * This fixture reproduces the *shape* of the live book measured on 2026-08-01 —
 * 41 positions, max weight 13.5%, p90 4.49%, median 1.64% — using synthetic
 * tickers and values. It deliberately does not carry real holdings.
 *
 * Fixed in PR 6: the old fixed /20 anchor compressed almost the whole book into
 * one narrow band and let only the largest position reach the red tier. The
 * portfolio-relative anchor (weightAnchor) spreads the same book across all
 * three tiers instead.
 */
describe('score distribution on a realistically flat book', () => {
  // Scaled to sum to exactly 100 with the measured max and median held fixed.
  const weights = [
    13.5, 6.0579, 5.2763, 4.4946, 4.3969, 4.0061, 3.7129, 3.4198, 3.1267, 2.9313, 2.7358,
    2.6381, 2.5404, 2.4427, 2.345, 2.2473, 2.1496, 2.0519, 1.9542, 1.9053, 1.8565, 1.8076,
    1.7588, 1.7099, 1.661, 1.64, 1.5633, 1.5145, 1.4656, 1.4168, 1.3679, 1.2702, 1.1725,
    1.0748, 0.9771, 0.8794, 0.7817, 0.684, 0.5863, 0.4885, 0.3908,
  ]
  // One unit of value per 1% of weight, so the weights above are the real ones.
  const book = weights.map((w, i) => holding(`T${i}`, w, 1))
  const total = portfolioTotalValue(book)
  const inThreeDays = '2026-08-04'

  it('reproduces the measured live shape', () => {
    expect(book).toHaveLength(41)
    expect(positionWeightPct(book[0], total)).toBeCloseTo(13.5, 1)
    expect(positionWeightPct(book[25], total)).toBeCloseTo(1.64, 1)
  })

  it('lets more than just the single largest position reach the red >=70 tier', () => {
    const scores = book.map(
      (h) => scoreEvent(earnings(h.ticker, inThreeDays), book, [], total, TODAY).impactScore,
    )

    expect(scores.filter((s) => s >= 70).length).toBeGreaterThan(1)
  })

  it('spreads the middle of the book out instead of compressing it', () => {
    const scores = book
      .map((h) => scoreEvent(earnings(h.ticker, inThreeDays), book, [], total, TODAY).impactScore)
      .sort((a, b) => a - b)

    const median = scores[Math.floor(scores.length / 2)]
    const p90 = scores[Math.floor(scores.length * 0.9)]

    expect(p90 - median).toBeGreaterThan(15)
  })
})

describe('scoreAndFilterEvents', () => {
  const book = [holding('AAA', 10, 100)]
  const events = [
    earnings('AAA', '2026-08-04'),
    { ...earnings('AAA', '2026-09-20'), id: 'ev-far' },
    {
      id: 'ev-macro',
      ticker: null,
      title: 'FOMC decision',
      eventType: 'fomc' as const,
      eventDate: '2026-08-05',
      timing: 'unknown' as const,
      status: 'confirmed' as const,
      source: 'macro',
    },
  ]

  it('defaults to a 14-day window from today', () => {
    const scored = scoreAndFilterEvents(events, book, [], { today: TODAY })
    expect(scored.map((e) => e.id)).not.toContain('ev-far')
  })

  it('includes an event on the last day of the window', () => {
    const onBoundary = [earnings('AAA', '2026-08-15')]
    const scored = scoreAndFilterEvents(onBoundary, book, [], { today: TODAY })

    expect(scored).toHaveLength(1)
  })

  it('excludes an event one day past the window', () => {
    const pastBoundary = [earnings('AAA', '2026-08-16')]
    const scored = scoreAndFilterEvents(pastBoundary, book, [], { today: TODAY })

    expect(scored).toHaveLength(0)
  })

  it('filters to earnings only', () => {
    const scored = scoreAndFilterEvents(events, book, [], { filter: 'earnings', today: TODAY })
    expect(scored.every((e) => e.eventType === 'earnings')).toBe(true)
  })

  it('filters to macro only', () => {
    const scored = scoreAndFilterEvents(events, book, [], { filter: 'macro', today: TODAY })
    expect(scored.map((e) => e.id)).toEqual(['ev-macro'])
  })

  it('filters to holdings only, dropping unheld tickers', () => {
    const withOther = [...events, earnings('NOTHELD', '2026-08-04')]
    const scored = scoreAndFilterEvents(withOther, book, [], { filter: 'holdings', today: TODAY })

    expect(scored.map((e) => e.ticker)).not.toContain('NOTHELD')
  })

  it('returns events ordered by impact, highest first', () => {
    const scored = scoreAndFilterEvents(events, book, [], { today: TODAY })
    const scores = scored.map((e) => e.impactScore)

    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })
})

describe('computeExposure', () => {
  const book = [holding('AAA', 25, 1), holding('BBB', 25, 1), holding('CCC', 50, 1)]

  it('counts only holdings reporting inside the 7-day window', () => {
    const events = [earnings('AAA', '2026-08-05'), earnings('CCC', '2026-08-20')]
    const exposure = computeExposure(events, book, [], TODAY)

    expect(exposure.earnings7dPct).toBeCloseTo(25, 1)
  })

  it('widens to 30 days for the longer window', () => {
    const events = [earnings('AAA', '2026-08-05'), earnings('CCC', '2026-08-20')]
    const exposure = computeExposure(events, book, [], TODAY)

    expect(exposure.earnings30dPct).toBeCloseTo(75, 1)
  })

  it('counts a ticker once even when it has several earnings rows', () => {
    const events = [earnings('CCC', '2026-08-05'), { ...earnings('CCC', '2026-08-06'), id: 'dup' }]
    const exposure = computeExposure(events, book, [], TODAY)

    expect(exposure.earnings7dPct).toBeCloseTo(50, 1)
  })

  it('ignores an unheld ticker reporting in the window', () => {
    const exposure = computeExposure([earnings('NOTHELD', '2026-08-05')], book, [], TODAY)
    expect(exposure.earnings7dPct).toBe(0)
  })

  it('reports zero exposure and no next event for an empty book', () => {
    const exposure = computeExposure([], [], [], TODAY)

    expect(exposure.earnings7dPct).toBe(0)
    expect(exposure.holdingsCount).toBe(0)
    expect(exposure.nextCritical).toBeNull()
  })

  it('picks the highest-impact held earnings event as next critical', () => {
    const flat = [holding('SMALL', 5, 1), holding('MID', 15, 1), holding('FILLER', 80, 1)]
    const events = [earnings('SMALL', '2026-08-05'), earnings('MID', '2026-08-06')]
    const exposure = computeExposure(events, flat, [], TODAY)

    expect(exposure.nextCritical?.ticker).toBe('MID')
  })
})

/**
 * Date boundaries. The client parses `YYYY-MM-DD` with date-fns `parseISO`,
 * which yields local midnight, while the Edge Functions emit `ymd()` from a UTC
 * timestamp. West of UTC those disagree about which day an event falls on.
 * Pinned as a characterization test — plan Workstream 5 calls this out and the
 * fix, if any, is not in this PR.
 */
describe('date handling', () => {
  it('treats an event dated today as in-window', () => {
    const scored = scoreAndFilterEvents([earnings('AAA', '2026-08-01')], [], [], { today: TODAY })
    expect(scored).toHaveLength(1)
  })

  it('excludes yesterday', () => {
    const scored = scoreAndFilterEvents([earnings('AAA', '2026-07-31')], [], [], { today: TODAY })
    expect(scored).toHaveLength(0)
  })

  it('gives a same-day event full recency credit', () => {
    const scored = scoreEvent(earnings('AAA', '2026-08-01'), [], [], 0, TODAY)
    expect(scored.impactBreakdown.recencyComponent).toBe(10)
  })
})
