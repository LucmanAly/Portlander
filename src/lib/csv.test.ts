import { describe, expect, it } from 'vitest'
import { holdingsToCsv, parseHoldingsCsv, planCsvImport } from '@/lib/csv'
import type { Holding } from '@/types'

function holding(partial: Partial<Holding> & Pick<Holding, 'ticker' | 'source'>): Holding {
  return {
    id: `id-${partial.ticker}`,
    shares: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('parseHoldingsCsv', () => {
  it('tags every parsed row as source=csv', () => {
    const { holdings } = parseHoldingsCsv('ticker,shares\nAAA,10\nBBB,20')
    expect(holdings.map((h) => h.source)).toEqual(['csv', 'csv'])
  })

  it('accepts symbol/quantity aliases and uppercases tickers', () => {
    const { holdings } = parseHoldingsCsv('symbol,quantity\naaa,5')
    expect(holdings[0].ticker).toBe('AAA')
    expect(holdings[0].shares).toBe(5)
  })

  it('rejects rows with non-positive or unparseable shares', () => {
    const { holdings, errors } = parseHoldingsCsv('ticker,shares\nAAA,0\nBBB,abc\nCCC,3')
    expect(holdings.map((h) => h.ticker)).toEqual(['CCC'])
    expect(errors).toHaveLength(2)
  })

  it('skips duplicate tickers rather than emitting both', () => {
    const { holdings, errors } = parseHoldingsCsv('ticker,shares\nAAA,10\nAAA,99')
    expect(holdings).toHaveLength(1)
    expect(holdings[0].shares).toBe(10)
    expect(errors[0]).toContain('duplicate')
  })

  it('round-trips through holdingsToCsv', () => {
    const original = [holding({ ticker: 'AAA', source: 'manual', shares: 12, lastPrice: 34.5 })]
    const { holdings } = parseHoldingsCsv(holdingsToCsv(original))
    expect(holdings[0].ticker).toBe('AAA')
    expect(holdings[0].shares).toBe(12)
    expect(holdings[0].lastPrice).toBe(34.5)
  })
})

describe('planCsvImport', () => {
  // The regression this exists for: onCsv used to hand the parsed rows straight
  // to replaceHoldings, which propagated a remote delete of every row the CSV
  // didn't mention — all 40 brokerage-synced positions, on one click.
  it('never drops a brokerage-synced row the CSV does not mention', () => {
    const existing = [
      holding({ ticker: 'SYNC1', source: 'snaptrade' }),
      holding({ ticker: 'SYNC2', source: 'snaptrade' }),
      holding({ ticker: 'OLDMANUAL', source: 'manual' }),
    ]
    const parsed = [holding({ ticker: 'NEW', source: 'csv' })]

    const plan = planCsvImport(existing, parsed)

    expect(plan.next.map((h) => h.ticker).sort()).toEqual(['NEW', 'SYNC1', 'SYNC2'])
    expect(plan.protectedSynced).toBe(2)
    expect(plan.imported).toBe(1)
  })

  it('replaces manual and csv rows the import does not carry forward', () => {
    const existing = [
      holding({ ticker: 'OLDMANUAL', source: 'manual' }),
      holding({ ticker: 'OLDCSV', source: 'csv' }),
    ]
    const plan = planCsvImport(existing, [holding({ ticker: 'NEW', source: 'csv' })])

    expect(plan.next.map((h) => h.ticker)).toEqual(['NEW'])
  })

  it('drops a CSV row that collides with a synced ticker, keeping the synced one', () => {
    const existing = [holding({ ticker: 'DUP', source: 'snaptrade', shares: 100 })]
    const plan = planCsvImport(existing, [holding({ ticker: 'dup', source: 'csv', shares: 1 })])

    expect(plan.next).toHaveLength(1)
    expect(plan.next[0].source).toBe('snaptrade')
    expect(plan.next[0].shares).toBe(100)
    expect(plan.skipped).toBe(1)
  })

  it('leaves synced rows intact when the CSV parses to nothing', () => {
    const existing = [holding({ ticker: 'SYNC1', source: 'snaptrade' })]
    const plan = planCsvImport(existing, [])

    expect(plan.next.map((h) => h.ticker)).toEqual(['SYNC1'])
    expect(plan.imported).toBe(0)
  })
})
