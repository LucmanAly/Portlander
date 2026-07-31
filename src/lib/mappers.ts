import type { EventStatus, EventTiming, EventType, Holding, PortfolioEvent, WatchlistItem } from '@/types'
import type { EventRow, HoldingRow, WatchlistRow } from '@/types/database'

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

export function holdingFromRow(row: HoldingRow): Holding {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name ?? undefined,
    shares: num(row.shares) ?? 0,
    costBasis: num(row.cost_basis),
    lastPrice: num(row.last_price),
    weightOverridePct: num(row.weight_override_pct),
    tags: row.tags ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function holdingToUpdate(h: Holding) {
  return {
    ticker: h.ticker.toUpperCase(),
    name: h.name ?? null,
    shares: h.shares,
    cost_basis: h.costBasis ?? null,
    last_price: h.lastPrice ?? null,
    weight_override_pct: h.weightOverridePct ?? null,
    tags: h.tags ?? [],
    notes: h.notes ?? null,
    updated_at: h.updatedAt,
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
  }
}
