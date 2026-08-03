import { describe, expect, it } from 'vitest'
import type { Holding } from '@/types'
import { liveDailyPerformance, preferredPerformanceWindow, snapshotPerformance } from '@/lib/performance'

const holding = (patch: Partial<Holding>): Holding => ({
  id: patch.ticker ?? 'id',
  ticker: 'CRWD',
  shares: 2,
  lastPrice: 110,
  dayChangeValue: 10,
  dayChangePct: 10,
  tags: ['cyber'],
  source: 'manual',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...patch,
})

describe('preferredPerformanceWindow', () => {
  it('uses today on a working day', () => {
    expect(preferredPerformanceWindow(new Date(2026, 6, 30, 12))).toEqual({
      startDate: '2026-07-30',
      endDate: '2026-07-30',
      kind: 'day',
    })
  })

  it('uses Monday through Friday on a weekend', () => {
    expect(preferredPerformanceWindow(new Date(2026, 7, 2, 12))).toEqual({
      startDate: '2026-07-27',
      endDate: '2026-07-31',
      kind: 'week',
    })
  })
})

describe('liveDailyPerformance', () => {
  it('calculates totals and tag attribution deterministically', () => {
    const result = liveDailyPerformance([
      holding({ ticker: 'CRWD' }),
      holding({ ticker: 'IONQ', shares: 4, lastPrice: 45, dayChangeValue: -5, tags: ['quantum'] }),
    ], '2026-07-30')

    expect(result.coverage).toBe('complete')
    expect(result.totalPnlValue).toBe(0)
    expect(result.totalReturnPct).toBeCloseTo(0)
    expect(result.themes.map((theme) => [theme.label, theme.pnlValue])).toEqual([
      ['Cybersecurity', 20],
      ['Quantum computing', -20],
    ])
  })

  it('withholds the total when any holding is missing quote evidence', () => {
    const result = liveDailyPerformance([
      holding({ ticker: 'CRWD' }),
      holding({ ticker: 'MSFT', dayChangeValue: undefined }),
    ], '2026-07-30')

    expect(result.coverage).toBe('partial')
    expect(result.totalPnlValue).toBeUndefined()
    expect(result.coveredPositions).toBe(1)
  })
})

describe('snapshotPerformance', () => {
  it('sums dollar movement and compounds daily returns', () => {
    const snapshots = [
      {
        snapshotDate: '2026-07-30', ticker: 'CRWD', shares: 1, price: 110,
        previousClose: 100, marketValue: 110, dayChangeValue: 10, tags: ['cyber'], capturedAt: 'x',
      },
      {
        snapshotDate: '2026-07-31', ticker: 'CRWD', shares: 1, price: 121,
        previousClose: 110, marketValue: 121, dayChangeValue: 11, tags: ['cyber'], capturedAt: 'y',
      },
    ]
    const runs = [
      { snapshotDate: '2026-07-30', status: 'ok' as const, expectedPositions: 1, capturedPositions: 1, missingTickers: [], capturedAt: 'x' },
      { snapshotDate: '2026-07-31', status: 'ok' as const, expectedPositions: 1, capturedPositions: 1, missingTickers: [], capturedAt: 'y' },
    ]
    const result = snapshotPerformance(snapshots, runs, '2026-07-30', '2026-07-31')

    expect(result.totalPnlValue).toBe(21)
    expect(result.totalReturnPct).toBeCloseTo(21)
    expect(result.themes[0].returnPct).toBeCloseTo(21)
  })

  it('ignores partial snapshot days', () => {
    const result = snapshotPerformance(
      [{ snapshotDate: '2026-07-30', ticker: 'CRWD', shares: 1, price: 110, previousClose: 100, marketValue: 110, dayChangeValue: 10, tags: ['cyber'], capturedAt: 'x' }],
      [{ snapshotDate: '2026-07-30', status: 'partial', expectedPositions: 2, capturedPositions: 1, missingTickers: ['MSFT'], capturedAt: 'x' }],
      '2026-07-30',
      '2026-07-30',
    )
    expect(result.coverage).toBe('unavailable')
    expect(result.totalPnlValue).toBeUndefined()
  })
})
