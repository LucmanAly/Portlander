import { describe, expect, it } from 'vitest'
import { buildLiveDaySummary, buildSnapshotSummary } from '@/lib/performance'
import type { Holding } from '@/types'
import type { PositionSnapshot } from '@/types/performance'

function holding(patch: Partial<Holding> = {}): Holding {
  return {
    id: crypto.randomUUID(),
    ticker: 'CRWD',
    shares: 2,
    lastPrice: 110,
    dayChangeValue: 10,
    tags: ['cybersecurity'],
    source: 'snaptrade',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    ...patch,
  }
}

function snapshot(
  snapshotDate: string,
  ticker: string,
  marketValue: number,
  patch: Partial<PositionSnapshot> = {},
): PositionSnapshot {
  return {
    snapshotId: `${snapshotDate}-${ticker}`,
    snapshotDate,
    capturedAt: `${snapshotDate}T20:00:00Z`,
    ticker,
    shares: 1,
    price: marketValue,
    marketValue,
    tags: [],
    source: 'snaptrade',
    ...patch,
  }
}

describe('buildLiveDaySummary', () => {
  it('computes whole-book and overlapping tag attribution from verified quote deltas', () => {
    const result = buildLiveDaySummary(
      [
        holding(),
        holding({ ticker: 'IONQ', shares: 4, lastPrice: 45, dayChangeValue: -5, tags: ['quantum'] }),
      ],
      '2026-08-03',
    )
    expect(result?.valueChange).toBe(0)
    expect(result?.tickerAttribution[0]).toMatchObject({ label: 'CRWD', valueChange: 20 })
    expect(result?.themeAttribution.map((item) => [item.label, item.valueChange])).toEqual([
      ['Cybersecurity', 20],
      ['Quantum', -20],
    ])
  })

  it('refuses a partial book instead of quietly excluding an unpriced holding', () => {
    expect(buildLiveDaySummary([holding(), holding({ ticker: 'MSFT', dayChangeValue: undefined })], '2026-08-03')).toBeUndefined()
  })
})

describe('buildSnapshotSummary', () => {
  it('uses the first and last complete captures and flags quantity changes', () => {
    const result = buildSnapshotSummary(
      [
        snapshot('2026-06-05', 'CRWD', 100, { tags: ['cybersecurity'] }),
        snapshot('2026-06-05', 'IONQ', 50, { tags: ['quantum'] }),
        snapshot('2026-07-10', 'CRWD', 120, { shares: 2, price: 60, tags: ['cybersecurity'] }),
        snapshot('2026-07-10', 'IONQ', 45, { tags: ['quantum'] }),
      ],
      '2026-06-05',
      '2026-07-10',
      'range',
    )
    expect(result).toMatchObject({ startValue: 150, endValue: 165, valueChange: 15, hasPositionChanges: true })
    expect(result?.themeAttribution.map((item) => [item.label, item.valueChange])).toEqual([
      ['Cybersecurity', 20],
      ['Quantum', -5],
    ])
  })

  it('requires at least two captured dates', () => {
    expect(buildSnapshotSummary([snapshot('2026-08-01', 'CRWD', 100)], '2026-08-01', '2026-08-01', 'range')).toBeUndefined()
  })
})
