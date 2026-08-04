import { getSupabase, resolveBackend } from '@/lib/supabase'
import { snapshotPerformance } from '@/lib/performance'
import type {
  GeneratedPerformanceNarrative,
  PerformanceSnapshot,
  PerformanceSnapshotRun,
  PerformanceSummary,
} from '@/types/performance'
import type { Holding } from '@/types'

export async function loadSnapshotPerformance(
  userId: string | null,
  startDate: string,
  endDate: string,
  currentHoldings: Holding[] = [],
): Promise<{ summary: PerformanceSummary | null; error: string | null }> {
  if (!userId || resolveBackend(true) !== 'supabase') return { summary: null, error: null }
  const sb = getSupabase()
  if (!sb) return { summary: null, error: 'Supabase is not configured' }

  const [runsResult, snapshotsResult] = await Promise.all([
    sb
      .from('portfolio_snapshot_runs')
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate)
      .order('snapshot_date'),
    sb
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate)
      .order('snapshot_date'),
  ])

  if (runsResult.error) return { summary: null, error: runsResult.error.message }
  if (snapshotsResult.error) return { summary: null, error: snapshotsResult.error.message }

  const runs: PerformanceSnapshotRun[] = (runsResult.data ?? []).map((row) => ({
    snapshotDate: row.snapshot_date,
    status: row.status === 'ok' || row.status === 'partial' ? row.status : 'error',
    expectedPositions: row.expected_positions,
    capturedPositions: row.captured_positions,
    missingTickers: row.missing_tickers ?? [],
    capturedAt: row.captured_at,
  }))
  const currentTags = new Map(
    currentHoldings.map((holding) => [holding.ticker.toUpperCase(), holding.tags ?? []]),
  )
  const snapshots: PerformanceSnapshot[] = (snapshotsResult.data ?? []).map((row) => ({
    snapshotDate: row.snapshot_date,
    ticker: row.ticker,
    shares: numeric(row.shares),
    price: numeric(row.price),
    previousClose: numeric(row.previous_close),
    marketValue: numeric(row.market_value),
    dayChangeValue: numeric(row.day_change_value),
    dayChangePct: row.day_change_pct == null ? undefined : numeric(row.day_change_pct),
    // Theme classification is portfolio metadata, not price evidence. Apply
    // today's owner-edited tags to still-held tickers so correcting a tag also
    // corrects historical views; sold tickers keep their captured tags.
    tags: currentTags.get(row.ticker.toUpperCase()) ?? row.tags ?? [],
    capturedAt: row.captured_at,
  }))

  return { summary: snapshotPerformance(snapshots, runs, startDate, endDate), error: null }
}

export async function generatePerformanceNarrative(
  summary: PerformanceSummary,
): Promise<{ narrative: GeneratedPerformanceNarrative | null; error: string | null }> {
  if (summary.coverage !== 'complete' || summary.totalPnlValue == null || summary.totalReturnPct == null) {
    return { narrative: null, error: null }
  }
  const sb = getSupabase()
  if (!sb) return { narrative: null, error: 'Supabase is not configured' }

  const { data, error } = await sb.functions.invoke('performance-interpret', {
    method: 'POST',
    body: {
      evidenceHash: summary.evidenceHash,
      startDate: summary.startDate,
      endDate: summary.endDate,
      totalPnlValue: round(summary.totalPnlValue),
      totalReturnPct: round(summary.totalReturnPct),
      themes: summary.themes.slice(0, 8).map((theme) => ({
        key: theme.key,
        label: theme.label,
        pnlValue: round(theme.pnlValue),
        returnPct: round(theme.returnPct ?? 0),
        tickers: theme.tickers,
      })),
      holdings: summary.holdings.slice(0, 8).map((holding) => ({
        ticker: holding.key,
        pnlValue: round(holding.pnlValue),
      })),
    },
  })
  if (error) return { narrative: null, error: error.message }
  if (!data?.headline || !data?.summary) {
    return { narrative: null, error: data?.error ?? 'Generated briefing was unavailable' }
  }

  return {
    narrative: {
      headline: data.headline,
      summary: data.summary,
      model: data.model ?? 'DeepSeek',
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      cached: Boolean(data.cached),
    },
    error: null,
  }
}

function numeric(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
