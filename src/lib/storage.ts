import type { Holding, PortfolioEvent, WatchlistItem } from '@/types'
import { DEMO_EVENTS, DEMO_HOLDINGS, DEMO_WATCHLIST } from '@/data/demo'
import { MACRO_EVENTS } from '@/data/macro'

const KEYS = {
  holdings: 'portlander.holdings.v1',
  watchlist: 'portlander.watchlist.v1',
  events: 'portlander.events.v1',
  lastSync: 'portlander.lastSync.v1',
  quotesLastSync: 'portlander.quotesLastSync.v1',
  seeded: 'portlander.seeded.v1',
} as const

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
  if (localStorage.getItem(KEYS.seeded) === '1') return
  writeJson(KEYS.holdings, DEMO_HOLDINGS)
  writeJson(KEYS.watchlist, DEMO_WATCHLIST)
  writeJson(KEYS.events, mergeEvents(DEMO_EVENTS, MACRO_EVENTS))
  localStorage.setItem(KEYS.lastSync, new Date().toISOString())
  localStorage.setItem(KEYS.seeded, '1')
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
  return readJson<Holding[]>(KEYS.holdings, [])
}

export function saveHoldings(holdings: Holding[]): void {
  writeJson(KEYS.holdings, holdings)
}

export function loadWatchlist(): WatchlistItem[] {
  ensureSeeded()
  return readJson<WatchlistItem[]>(KEYS.watchlist, [])
}

export function saveWatchlist(items: WatchlistItem[]): void {
  writeJson(KEYS.watchlist, items)
}

export function loadEvents(): PortfolioEvent[] {
  ensureSeeded()
  return readJson<PortfolioEvent[]>(KEYS.events, [])
}

export function saveEvents(events: PortfolioEvent[]): void {
  writeJson(KEYS.events, events)
}

export function loadLastSync(): string | null {
  return localStorage.getItem(KEYS.lastSync)
}

export function setLastSync(iso: string): void {
  localStorage.setItem(KEYS.lastSync, iso)
}

/** Separate from events lastSync — tracks the manual "Refresh prices" action only. */
export function loadQuotesLastSync(): string | null {
  return localStorage.getItem(KEYS.quotesLastSync)
}

export function setQuotesLastSync(iso: string): void {
  localStorage.setItem(KEYS.quotesLastSync, iso)
}

/** Reset demo data (Settings). */
export function resetToDemo(): void {
  localStorage.removeItem(KEYS.seeded)
  ensureSeeded()
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}
