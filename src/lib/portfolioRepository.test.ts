import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Holding } from '@/types'

/**
 * Characterization tests for `persistHoldingsRemote`.
 *
 * PR 5 of docs/PLAN-2026-08.md replaces its select-all → delete-missing →
 * upsert-all shape with per-row writes under an explicit authority model. These
 * pin what it does today so that rewrite is provably behaviour-preserving except
 * where it is meant to change. Where a test documents behaviour that is a known
 * defect rather than a requirement, it says so.
 */

interface RecordedOp {
  op: 'select' | 'delete' | 'upsert'
  table: string
  ids?: string[]
  rows?: Record<string, unknown>[]
}

let ops: RecordedOp[] = []
let existingRows: { id: string; ticker: string; source: string }[] = []

function fakeClient() {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              ops.push({ op: 'select', table })
              return Promise.resolve({ data: existingRows, error: null })
            },
          }
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              ops.push({ op: 'delete', table, ids })
              return Promise.resolve({ error: null })
            },
          }
        },
        upsert(rows: Record<string, unknown>[], _opts: unknown) {
          ops.push({ op: 'upsert', table, rows })
          return Promise.resolve({ error: null })
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

const { persistHoldingsRemote } = await import('@/lib/portfolioRepository')
const { setStorageNamespace } = await import('@/lib/storage')

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
  localStorage.clear()
  setStorageNamespace(USER)
})

describe('persistHoldingsRemote', () => {
  it('is a local-only write when signed out', async () => {
    await persistHoldingsRemote([holding({ ticker: 'AAA', source: 'manual' })], null)
    expect(ops).toEqual([])
  })

  it('deletes remote manual rows absent from the client list', async () => {
    existingRows = [
      { id: 'db-1', ticker: 'GONE', source: 'manual' },
      { id: 'db-2', ticker: 'KEPT', source: 'manual' },
    ]

    await persistHoldingsRemote([holding({ ticker: 'KEPT', source: 'manual' })], USER)

    expect(ops.find((o) => o.op === 'delete')?.ids).toEqual(['db-1'])
  })

  // The guard added in PR 1. Only snaptrade-sync may remove a synced row,
  // because only it can tell "sold at the brokerage" from "this client is not
  // holding a complete list right now".
  it('never deletes a brokerage-synced row, however short the client list', async () => {
    existingRows = [
      { id: 'db-1', ticker: 'SYNC1', source: 'snaptrade' },
      { id: 'db-2', ticker: 'SYNC2', source: 'snaptrade' },
      { id: 'db-3', ticker: 'MANUAL', source: 'manual' },
    ]

    await persistHoldingsRemote([], USER)

    expect(ops.find((o) => o.op === 'delete')?.ids).toEqual(['db-3'])
  })

  it('issues no delete when every remote row is still present', async () => {
    existingRows = [{ id: 'db-1', ticker: 'AAA', source: 'manual' }]

    await persistHoldingsRemote([holding({ ticker: 'AAA', source: 'manual' })], USER)

    expect(ops.some((o) => o.op === 'delete')).toBe(false)
  })

  it('matches remote rows case-insensitively', async () => {
    existingRows = [{ id: 'db-1', ticker: 'aaa', source: 'manual' }]

    await persistHoldingsRemote([holding({ ticker: 'AAA', source: 'manual' })], USER)

    expect(ops.some((o) => o.op === 'delete')).toBe(false)
  })

  it('skips the upsert entirely for an empty client list', async () => {
    existingRows = [{ id: 'db-1', ticker: 'GONE', source: 'manual' }]

    await persistHoldingsRemote([], USER)

    expect(ops.some((o) => o.op === 'upsert')).toBe(false)
  })

  it('uppercases tickers on the way out', async () => {
    await persistHoldingsRemote([holding({ ticker: 'aaa', source: 'manual' })], USER)

    expect(ops.find((o) => o.op === 'upsert')?.rows?.[0].ticker).toBe('AAA')
  })

  it('preserves each row source', async () => {
    await persistHoldingsRemote(
      [
        holding({ ticker: 'AAA', source: 'manual' }),
        holding({ ticker: 'BBB', source: 'csv' }),
        holding({ ticker: 'CCC', source: 'snaptrade' }),
      ],
      USER,
    )

    const rows = ops.find((o) => o.op === 'upsert')?.rows ?? []
    expect(rows.map((r) => r.source)).toEqual(['manual', 'csv', 'snaptrade'])
  })

  // KNOWN DEFECT, pinned rather than endorsed. last_price and day_change_* are
  // refresh-quotes's fields, but the browser sends them on every write, so a
  // client holding a stale price can overwrite a fresher one. PR 5 stops the
  // client sending them at all — update this test then.
  it('currently sends price fields the browser has no authority over', async () => {
    await persistHoldingsRemote(
      [holding({ ticker: 'AAA', source: 'snaptrade', lastPrice: 1, dayChangePct: 2 })],
      USER,
    )

    const row = ops.find((o) => o.op === 'upsert')?.rows?.[0] ?? {}
    expect(row).toHaveProperty('last_price', 1)
    expect(row).toHaveProperty('day_change_pct', 2)
  })

  it('writes the local cache even when the remote write is skipped', async () => {
    setStorageNamespace(null)
    await persistHoldingsRemote([holding({ ticker: 'AAA', source: 'manual' })], null)

    expect(localStorage.getItem('portlander.holdings.v1')).toContain('AAA')
  })
})
