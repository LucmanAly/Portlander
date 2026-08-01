import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Holding } from '@/types'

/**
 * Characterization tests for the per-row write primitives PR 5 introduced,
 * replacing `persistHoldingsRemote`'s select-all → delete-missing →
 * upsert-all shape. Local caching (`saveHoldings`) moved to the caller
 * (`PortfolioContext`) as part of that split, so it's no longer exercised
 * here — these test the remote write only.
 */

interface RecordedOp {
  op: 'upsert' | 'delete'
  table: string
  ids?: string[]
  rows?: Record<string, unknown>[]
}

let ops: RecordedOp[] = []
let existingRows: { id: string; source: string }[] = []

/**
 * Simulates the DB-level guard in `deleteHoldingsRemote`'s
 * `.neq('source', 'snaptrade')`: only ids that exist and aren't
 * source='snaptrade' are actually removed, exactly like Postgres would filter
 * the WHERE clause — this lets tests prove the guard holds even when the
 * caller passes a snaptrade id, not just when it politely omits one.
 */
function fakeClient() {
  return {
    from(table: string) {
      return {
        upsert(rows: Record<string, unknown>[], _opts: unknown) {
          ops.push({ op: 'upsert', table, rows })
          return Promise.resolve({ error: null })
        },
        delete() {
          return {
            eq(_col: string, _val: string) {
              return {
                in(_col2: string, ids: string[]) {
                  return {
                    neq(_col3: string, guardVal: string) {
                      const affected = ids.filter((id) => {
                        const row = existingRows.find((r) => r.id === id)
                        return !row || row.source !== guardVal
                      })
                      ops.push({ op: 'delete', table, ids: affected })
                      return Promise.resolve({ error: null })
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => fakeClient(),
  resolveBackend: (signedIn: boolean) => (signedIn ? 'supabase' : 'local'),
  isSupabaseConfigured: () => true,
}))

const { upsertHoldingsRemote, deleteHoldingsRemote } = await import('@/lib/portfolioRepository')

function holding(partial: Partial<Holding> & Pick<Holding, 'ticker' | 'source'>): Holding {
  return {
    id: `id-${partial.ticker}`,
    shares: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const USER = 'user-a'

beforeEach(() => {
  ops = []
  existingRows = []
})

describe('upsertHoldingsRemote', () => {
  it('is a no-op when signed out', async () => {
    await upsertHoldingsRemote([holding({ ticker: 'AAA', source: 'manual' })], null)
    expect(ops).toEqual([])
  })

  it('skips the upsert entirely for an empty rows list', async () => {
    await upsertHoldingsRemote([], USER)
    expect(ops).toEqual([])
  })

  it('upserts exactly the given rows — nothing else', async () => {
    await upsertHoldingsRemote(
      [holding({ ticker: 'AAA', source: 'manual' }), holding({ ticker: 'BBB', source: 'csv' })],
      USER,
    )
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('upsert')
    expect(ops[0].rows?.map((r) => r.ticker)).toEqual(['AAA', 'BBB'])
  })

  it('uppercases tickers on the way out', async () => {
    await upsertHoldingsRemote([holding({ ticker: 'aaa', source: 'manual' })], USER)
    expect(ops[0].rows?.[0].ticker).toBe('AAA')
  })

  it('preserves each row source', async () => {
    await upsertHoldingsRemote(
      [
        holding({ ticker: 'AAA', source: 'manual' }),
        holding({ ticker: 'BBB', source: 'csv' }),
        holding({ ticker: 'CCC', source: 'snaptrade' }),
      ],
      USER,
    )
    expect(ops[0].rows?.map((r) => r.source)).toEqual(['manual', 'csv', 'snaptrade'])
  })

  // Fixed in PR 5. Previously the client sent last_price/day_change_* (Finnhub's
  // fields) and created_at (the DB default's field) on every write.
  it('never sends last_price, day_change_*, or created_at — those belong to refresh-quotes and the DB default', async () => {
    await upsertHoldingsRemote(
      [
        holding({
          ticker: 'AAA',
          source: 'snaptrade',
          lastPrice: 1,
          dayChangeValue: 2,
          dayChangePct: 3,
          createdAt: '2020-01-01T00:00:00.000Z',
        }),
      ],
      USER,
    )
    const row = ops[0].rows?.[0] ?? {}
    expect(row).not.toHaveProperty('last_price')
    expect(row).not.toHaveProperty('day_change_value')
    expect(row).not.toHaveProperty('day_change_pct')
    expect(row).not.toHaveProperty('created_at')
  })
})

describe('deleteHoldingsRemote', () => {
  it('is a no-op when signed out', async () => {
    await deleteHoldingsRemote(['db-1'], null)
    expect(ops).toEqual([])
  })

  it('skips the delete entirely for an empty ids list', async () => {
    await deleteHoldingsRemote([], USER)
    expect(ops).toEqual([])
  })

  it('deletes exactly the given ids', async () => {
    existingRows = [
      { id: 'db-1', source: 'manual' },
      { id: 'db-2', source: 'manual' },
    ]
    await deleteHoldingsRemote(['db-1'], USER)
    expect(ops[0]).toMatchObject({ op: 'delete', ids: ['db-1'] })
  })

  // The guard added in PR 1, moved to the query itself in PR 5. Only
  // snaptrade-sync may remove a synced row — enforced by the DB filter, not
  // by trusting every call site to pre-filter its id list correctly.
  it('never deletes a row whose source is snaptrade, even if its id is explicitly requested', async () => {
    existingRows = [
      { id: 'db-1', source: 'snaptrade' },
      { id: 'db-2', source: 'manual' },
    ]
    await deleteHoldingsRemote(['db-1', 'db-2'], USER)
    expect(ops[0]).toMatchObject({ op: 'delete', ids: ['db-2'] })
  })
})
