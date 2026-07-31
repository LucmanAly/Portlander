import type { PortfolioEvent } from '@/types'
import { loadEvents, saveEvents, setLastSync } from '@/lib/storage'

export interface SyncFilePayload {
  generatedAt: string
  provider: string
  from: string
  to: string
  tickers: string[]
  events: PortfolioEvent[]
  errors?: string[]
}

/**
 * Fetch local sync file written by `npm run sync:events`.
 * Returns null if missing (404) or invalid.
 */
export async function fetchLocalEventsSync(
  signal?: AbortSignal,
): Promise<SyncFilePayload | null> {
  try {
    const res = await fetch(`/data/events-sync.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as SyncFilePayload
    if (!data || !Array.isArray(data.events)) return null
    return data
  } catch {
    return null
  }
}

/**
 * Merge Finnhub/local-sync events over existing ones by id.
 * Prefer sync file for same id; keep manual/demo events not present in sync.
 * When sync has earnings for a ticker+date, drop older demo earnings with different ids
 * for the same ticker on that date.
 */
export function mergeEvents(
  existing: PortfolioEvent[],
  incoming: PortfolioEvent[],
): PortfolioEvent[] {
  const byId = new Map<string, PortfolioEvent>()
  for (const e of existing) byId.set(e.id, e)

  const incomingKeys = new Set(
    incoming
      .filter((e) => e.eventType === 'earnings' && e.ticker)
      .map((e) => `${e.ticker!.toUpperCase()}|${e.eventDate}`),
  )

  // Drop demo/local earnings that match a synced ticker+date (avoid duplicates)
  for (const [id, e] of [...byId.entries()]) {
    if (e.eventType !== 'earnings' || !e.ticker) continue
    if (e.source === 'finnhub') continue
    const key = `${e.ticker.toUpperCase()}|${e.eventDate}`
    if (incomingKeys.has(key)) byId.delete(id)
  }

  for (const e of incoming) {
    byId.set(e.id, e)
  }

  return [...byId.values()]
}

/**
 * Load /data/events-sync.json and merge into localStorage events.
 * Safe no-op when file is absent.
 */
export async function applyLocalEventsSync(): Promise<{
  applied: boolean
  count: number
  generatedAt: string | null
  errors: string[]
}> {
  const payload = await fetchLocalEventsSync()
  if (!payload) {
    return { applied: false, count: 0, generatedAt: null, errors: [] }
  }

  const existing = loadEvents()
  const merged = mergeEvents(existing, payload.events)
  saveEvents(merged)
  setLastSync(payload.generatedAt || new Date().toISOString())

  return {
    applied: true,
    count: payload.events.length,
    generatedAt: payload.generatedAt,
    errors: payload.errors ?? [],
  }
}
