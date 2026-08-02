import type {
  BrokerageConnection,
  EventStatus,
  EventTiming,
  EventType,
  Holding,
  HoldingSource,
  PortfolioEvent,
  WatchlistItem,
} from '@/types'
import type { EventRow, HoldingRow, SnaptradeConnectionRow, WatchlistRow } from '@/types/database'

function num(v: number | string | null | undefined): number | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

const EVENT_TYPES: EventType[] = [
  'earnings',
  'ex_div',
  'pay_div',
  'fomc',
  'cpi',
  'nfp',
  'other_macro',
]

function asEventType(v: string): EventType {
  return (EVENT_TYPES.includes(v as EventType) ? v : 'other_macro') as EventType
}

function asTiming(v: string): EventTiming {
  if (v === 'bmo' || v === 'amc' || v === 'unknown') return v
  return 'unknown'
}

function asStatus(v: string): EventStatus {
  return v === 'confirmed' ? 'confirmed' : 'estimated'
}

function asHoldingSource(v: string): HoldingSource {
  return v === 'csv' || v === 'snaptrade' ? v : 'manual'
}

export function holdingFromRow(row: HoldingRow): Holding {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name ?? undefined,
    shares: num(row.shares) ?? 0,
    costBasis: num(row.cost_basis),
    lastPrice: num(row.last_price),
    dayChangeValue: num(row.day_change_value),
    dayChangePct: num(row.day_change_pct),
    weightOverridePct: num(row.weight_override_pct),
    tags: row.tags ?? undefined,
    notes: row.notes ?? undefined,
    source: asHoldingSource(row.source),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Columns the browser actually has authority over. Deliberately excludes
 * `last_price`/`day_change_value`/`day_change_pct` (refresh-quotes's Finnhub
 * data — a client holding a stale price must never overwrite a fresher one)
 * and `created_at` (the DB default owns it on insert; re-sending it on every
 * update risks a stale client clobbering the real creation timestamp).
 * Postgres `ON CONFLICT DO UPDATE` only touches columns present in the
 * payload, so omitting these here is what keeps them untouched by this path.
 */
export function holdingToWrite(h: Holding) {
  return {
    ticker: h.ticker.toUpperCase(),
    name: h.name ?? null,
    shares: h.shares,
    cost_basis: h.costBasis ?? null,
    weight_override_pct: h.weightOverridePct ?? null,
    tags: h.tags ?? [],
    notes: h.notes ?? null,
    source: h.source,
    updated_at: h.updatedAt,
  }
}

export function brokerageConnectionFromRow(row: SnaptradeConnectionRow): BrokerageConnection {
  return {
    id: row.id,
    brokerageName: row.brokerage_name,
    authorizationId: row.authorization_id,
    connectedAt: row.connected_at,
  }
}

export function watchlistFromRow(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name ?? undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
  }
}

/**
 * Merges `events`' typed `eps_estimate`/`eps_actual`/`revenue_estimate`/
 * `revenue_actual` columns over the `raw` jsonb payload into one object, so
 * `earningsIntel.ts`'s `earningsFactsFromRaw()`/`earningsHistoryFromEvents()`
 * have a single shape to read regardless of which one actually holds a given
 * row's numbers. The typed columns are the more authoritative, freshly
 * written source (`sync-events`' `toEventRow()` sets both on every sync); the
 * jsonb fallback covers fields the typed columns don't carry, like `quarter`/
 * `year` for history's quarter labels. Returns undefined for rows with
 * neither (macro rows, pre-sync placeholders) — same honest-undefined rule
 * as everywhere else.
 */
function mergedRaw(row: EventRow): Record<string, unknown> | undefined {
  const jsonbRaw = (row.raw as Record<string, unknown> | null) ?? null
  const typed: Record<string, unknown> = {}
  const epsEstimate = num(row.eps_estimate)
  const epsActual = num(row.eps_actual)
  const revenueEstimate = num(row.revenue_estimate)
  const revenueActual = num(row.revenue_actual)
  if (epsEstimate != null) typed.epsEstimate = epsEstimate
  if (epsActual != null) typed.epsActual = epsActual
  if (revenueEstimate != null) typed.revenueEstimate = revenueEstimate
  if (revenueActual != null) typed.revenueActual = revenueActual

  if (jsonbRaw == null && Object.keys(typed).length === 0) return undefined
  return { ...(jsonbRaw ?? {}), ...typed }
}

export function eventFromRow(row: EventRow): PortfolioEvent {
  return {
    id: row.id,
    ticker: row.ticker,
    title: row.title,
    eventType: asEventType(row.event_type),
    eventDate: row.event_date,
    eventTime: row.event_time,
    timing: asTiming(row.timing),
    status: asStatus(row.status),
    source: row.source ?? undefined,
    description: row.description ?? undefined,
    raw: mergedRaw(row),
    updatedAt: row.updated_at,
    interpretation: (row.ai_interpretation as Record<string, unknown> | null) ?? undefined,
  }
}
