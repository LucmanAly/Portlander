import clsx from 'clsx'
import type { EventStatus, EventType } from '@/types'
import { eventTypeLabel, isDividendType, isMacroType, type ScoreTier } from '@/lib/scoring'
import { formatSignedPct } from '@/lib/format'

export function TypeBadge({ type }: { type: EventType }) {
  const tone = isMacroType(type)
    ? 'bg-macro-soft text-macro border-macro/25'
    : isDividendType(type)
      ? 'bg-dividend-soft text-dividend border-dividend/25'
      : type === 'earnings'
        ? 'bg-earnings-soft text-earnings border-earnings/25'
        : 'bg-ink-800 text-ink-300 border-border'

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium tracking-wide',
        tone,
      )}
    >
      {eventTypeLabel(type)}
    </span>
  )
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        status === 'confirmed'
          ? 'border-accent-500/30 bg-accent-glow text-accent-400'
          : 'border-border bg-ink-800 text-ink-400',
      )}
    >
      {status === 'confirmed' ? 'Confirmed' : 'Estimated'}
    </span>
  )
}

export function TimingBadge({ timing }: { timing: 'bmo' | 'amc' | 'unknown' }) {
  if (timing === 'unknown') return null
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium text-ink-300">
      {timing === 'bmo' ? 'BMO' : 'AMC'}
    </span>
  )
}

/** EPS/revenue beat (green) or miss (red) as a percent of estimate. Renders nothing pre-report. */
export function BeatMissBadge({ label, pct }: { label: string; pct: number | undefined }) {
  if (pct == null || !Number.isFinite(pct)) return null
  const beat = pct >= 0
  return (
    <span
      className={clsx(
        'tabular inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        beat
          ? 'border-positive/30 bg-positive-soft text-positive'
          : 'border-critical/30 bg-critical-soft text-critical',
      )}
    >
      {label} {formatSignedPct(pct)}
    </span>
  )
}

/** Neutral pre-report estimate chip — "know what's expected" before there's an actual to compare. */
export function EstimateBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-400">
      {label} est {value}
    </span>
  )
}

const TIER_LABEL: Record<ScoreTier, string> = { high: 'High', medium: 'Med', low: 'Low' }
const TIER_TONE: Record<ScoreTier, string> = {
  high: 'border-critical/30 bg-critical-soft text-critical',
  medium: 'border-earnings/30 bg-earnings-soft text-earnings',
  low: 'border-border bg-ink-800 text-ink-400',
}

/** Impact score, demoted to a tier badge — the number itself lives on the card's weight hero now. */
export function TierBadge({ tier }: { tier: ScoreTier }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        TIER_TONE[tier],
      )}
    >
      {TIER_LABEL[tier]} impact
    </span>
  )
}
