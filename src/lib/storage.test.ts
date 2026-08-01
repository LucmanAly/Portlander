import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  loadHoldings,
  resetToDemo,
  saveHoldings,
  setStorageNamespace,
} from '@/lib/storage'
import type { Holding } from '@/types'

const REAL: Holding[] = [
  {
    id: 'real-1',
    ticker: 'REAL',
    shares: 100,
    source: 'snaptrade',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

beforeEach(() => {
  localStorage.clear()
  setStorageNamespace(null)
})

describe('storage namespacing', () => {
  it('keeps the signed-out namespace on the original unprefixed keys', () => {
    saveHoldings(REAL)
    expect(localStorage.getItem('portlander.holdings.v1')).not.toBeNull()
  })

  it('writes a signed-in user to their own key, not the shared one', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)

    expect(localStorage.getItem('portlander.u.user-a.holdings.v1')).not.toBeNull()
    expect(localStorage.getItem('portlander.holdings.v1')).toBeNull()
  })

  it('does not leak one user cache into another', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)

    setStorageNamespace('user-b')
    expect(loadHoldings()).toEqual([])
  })

  // The regression: keys were static, so signing out re-read the same rows and
  // the real portfolio stayed on screen.
  it('leaves no real holdings behind after a sign-out sequence', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)

    clearAllData()
    setStorageNamespace(null)

    expect(localStorage.getItem('portlander.u.user-a.holdings.v1')).toBeNull()
    expect(loadHoldings().some((h) => h.ticker === 'REAL')).toBe(false)
  })

  it('clears only the namespace it is called on', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)
    setStorageNamespace('user-b')
    saveHoldings(REAL)

    clearAllData()

    expect(localStorage.getItem('portlander.u.user-b.holdings.v1')).toBeNull()
    expect(localStorage.getItem('portlander.u.user-a.holdings.v1')).not.toBeNull()
  })
})

describe('demo seeding', () => {
  it('seeds demo holdings for the signed-out namespace', () => {
    expect(loadHoldings().length).toBeGreaterThan(0)
  })

  it('refuses to seed demo rows into a signed-in namespace', () => {
    setStorageNamespace('user-a')
    expect(loadHoldings()).toEqual([])
  })

  it('does not overwrite a cached portfolio on later reads', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)
    expect(loadHoldings()).toEqual(REAL)
  })

  it('resetToDemo returns to the signed-out namespace', () => {
    setStorageNamespace('user-a')
    saveHoldings(REAL)

    resetToDemo()

    expect(loadHoldings().some((h) => h.ticker === 'REAL')).toBe(false)
    expect(localStorage.getItem('portlander.u.user-a.holdings.v1')).not.toBeNull()
  })
})
