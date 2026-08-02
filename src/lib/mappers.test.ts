import { describe, expect, it } from 'vitest'
import { eventFromRow } from '@/lib/mappers'
import type { EventRow } from '@/types/database'

function row(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'ev-1',
    user_id: null,
    ticker: 'AAPL',
    title: 'Apple earnings',
    event_type: 'earnings',
    event_date: '2026-07-30',
    event_time: null,
    timing: 'amc',
    status: 'confirmed',
    source: 'finnhub',
    description: 'Q3 2026 · EPS est 1.5 · EPS act 1.64',
    raw: null,
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T21:00:00Z',
    eps_estimate: null,
    eps_actual: null,
    revenue_estimate: null,
    revenue_actual: null,
    ai_interpretation: null,
    ...overrides,
  }
}

describe('eventFromRow — raw/typed-column merge', () => {
  it('returns raw: undefined when neither typed columns nor jsonb raw carry anything', () => {
    expect(eventFromRow(row()).raw).toBeUndefined()
  })

  it('reads numbers from the typed columns when jsonb raw is null', () => {
    const event = eventFromRow(
      row({ eps_estimate: 1.5, eps_actual: 1.64, revenue_estimate: 94_500_000_000, revenue_actual: 96_200_000_000 }),
    )
    expect(event.raw).toEqual({
      epsEstimate: 1.5,
      epsActual: 1.64,
      revenueEstimate: 94_500_000_000,
      revenueActual: 96_200_000_000,
    })
  })

  it('preserves jsonb-only fields (quarter/year) that the typed columns do not carry', () => {
    const event = eventFromRow(
      row({
        raw: { date: '2026-07-30', symbol: 'AAPL', quarter: 3, year: 2026 },
        eps_estimate: 1.5,
        eps_actual: 1.64,
      }),
    )
    expect(event.raw).toEqual({
      date: '2026-07-30',
      symbol: 'AAPL',
      quarter: 3,
      year: 2026,
      epsEstimate: 1.5,
      epsActual: 1.64,
    })
  })

  it('prefers the typed column over a conflicting value in jsonb raw', () => {
    const event = eventFromRow(row({ raw: { epsEstimate: 999 }, eps_estimate: 1.5 }))
    expect(event.raw?.epsEstimate).toBe(1.5)
  })

  it('coerces numeric-as-string typed columns (Postgres numeric over PostgREST) into real numbers', () => {
    const event = eventFromRow(row({ eps_estimate: '1.5' as unknown as number, eps_actual: '1.64' as unknown as number }))
    expect(event.raw).toEqual({ epsEstimate: 1.5, epsActual: 1.64 })
  })

  it('leaves macro rows (raw: null, no typed columns) with raw: undefined', () => {
    const event = eventFromRow(row({ ticker: null, event_type: 'fomc', source: 'macro-calendar', raw: null }))
    expect(event.raw).toBeUndefined()
  })
})

describe('eventFromRow — ai_interpretation (BE-06)', () => {
  it('maps ai_interpretation: null to interpretation: undefined', () => {
    expect(eventFromRow(row()).interpretation).toBeUndefined()
  })

  it('passes a stored ai_interpretation object through unvalidated — earningsIntel.ts revalidates on read', () => {
    const event = eventFromRow(row({ ai_interpretation: { summary: 'Beat on both lines.', confidence: 'high' } }))
    expect(event.interpretation).toEqual({ summary: 'Beat on both lines.', confidence: 'high' })
  })
})
