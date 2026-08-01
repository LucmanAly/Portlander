import type { Holding, PortfolioEvent, WatchlistItem } from '@/types'
import { DEMO_EVENTS, DEMO_HOLDINGS, DEMO_WATCHLIST } from '@/data/demo'
import { MACRO_EVENTS } from '@/data/macro'

const KEY_SUFFIXES = {
  holdings: 'holdings.v1',
  watchlist: 'watchlist.v1',
  events: 'events.v1',
  lastSync: 'lastSync.v1',
  quotesLastSync: 'quotesLastSync.v1',
  seeded: 'seeded.v1',
} as const

type KeyName = keyof typeof KEY_SUFFIXES

/**
 * Which user's cache the keys below address. `null` is the signed-out/demo
 * namespace and keeps the original unprefixed key names, so an existing demo
 * cache survives this change untouched.
 *
 * Without this, every user shares one set of keys: signing out left the real
 * portfolio on disk under the same key the next session reads.
 */
let namespace: string | null = null

/** Call on every auth transition, before any load/save for the new identity. */
export function setStorageNamespace(userId: string | null): void {
  namespace = userId
}

function key(name: KeyName): string {
  return namespace
    ? `portlander.u.${namespace}.${KEY_SUFFIXES[name]}`
    : `portlander.${KEY_SUFFIXES[name]}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function ensureSeeded(): void {
  // Demo rows belong to the signed-out namespace only. A signed-in user's cache
  // is populated from Supabase — seeding demo holdings into it would put
  // fabricated positions in front of someone looking at their real book.
  if (namespace) return
  if (localStorage.getItem(key('seeded')) === '1') return
  writeJson(key('holdings'), DEMO_HOLDINGS)
  writeJson(key('watchlist'), DEMO_WATCHLIST)
  writeJson(key('events'), mergeEvents(DEMO_EVENTS, MACRO_EVENTS))
  localStorage.setItem(key('lastSync'), new Date().toISOString())
  localStorage.setItem(key('seeded'), '1')
}

function mergeEvents(a: PortfolioEvent[], b: PortfolioEvent[]): PortfolioEvent[] {
  const map = new Map<string, PortfolioEvent>()
  for (const e of [...a, ...b]) {
    map.set(e.id, e)
  }
  return [...map.values()]
}

export function loadHoldings(): Holding[] {
  ensureSeeded()
  return readJson<Holding[]>(key('holdings'), [])
}

export function saveHoldings(holdings: Holding[]): void {
  writeJson(key('holdings'), holdings)
}

export function loadWatchlist(): WatchlistItem[] {
  ensureSeeded()
  return readJson<WatchlistItem[]>(key('watchlist'), [])
}

export function saveWatchlist(items: WatchlistItem[]): void {
  writeJson(key('watchlist'), items)
}

export function loadEvents(): PortfolioEvent[] {
  ensureSeeded()
  return readJson<PortfolioEvent[]>(key('events'), [])
}

export function saveEvents(events: PortfolioEvent[]): void {
  writeJson(key('events'), events)
}

export function loadLastSync(): string | null {
  return localStorage.getItem(key('lastSync'))
}

export function setLastSync(iso: string): void {
  localStorage.setItem(key('lastSync'), iso)
}

/** Separate from events lastSync — tracks the manual "Refresh prices" action only. */
export function loadQuotesLastSync(): string | null {
  return localStorage.getItem(key('quotesLastSync'))
}

export function setQuotesLastSync(iso: string): void {
  localStorage.setItem(key('quotesLastSync'), iso)
}

/** Reset demo data (Settings). Demo is inherently the signed-out experience. */
export function resetToDemo(): void {
  setStorageNamespace(null)
  localStorage.removeItem(key('seeded'))
  ensureSeeded()
}

/** Wipes the currently-addressed namespace. Called on sign-out, before the namespace resets. */
export function clearAllData(): void {
  ;(Object.keys(KEY_SUFFIXES) as KeyName[]).forEach((k) => localStorage.removeItem(key(k)))
}
