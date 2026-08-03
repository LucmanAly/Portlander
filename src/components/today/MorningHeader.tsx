import { formatMoney, formatRelativeSync, formatSignedPct, isStaleSync } from '@/lib/format'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'

export function MorningHeader({
  totalValue,
  dayChange,
  dayChangePct,
  lastSyncAt,
  holdingsCount,
  children,
}: {
  totalValue: number
  dayChange?: number
  dayChangePct?: number
  lastSyncAt: string | null
  holdingsCount: number
  children?: ReactNode
}) {
  const tone = dayChange == null ? 'text-ink-300' : dayChange >= 0 ? 'text-positive' : 'text-critical'
  const stale = isStaleSync(lastSyncAt)

  return (
    <header className="surface-elevated rounded-2xl p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">Morning desk</p>
      {/* The dollar value below is the real visual lede (per UX-03); this heading exists for
          a11y/page-structure parity with every other route, which all have a visible h1. */}
      <h1 className="sr-only">Today</h1>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="tabular text-3xl font-semibold tracking-tight text-ink-100">
            {formatMoney(totalValue)}
          </div>
          {dayChange == null ? (
            <p className="mt-1 text-sm text-ink-450">Day change unavailable — refresh prices</p>
          ) : (
            <p className={clsx('tabular mt-1 text-sm font-medium', tone)}>
              {dayChange >= 0 ? '+' : ''}
              {formatMoney(dayChange)} ({formatSignedPct(dayChangePct)} today)
            </p>
          )}
        </div>
        <p className={clsx('flex items-center gap-1 text-xs', stale ? 'text-amber-300' : 'text-ink-450')}>
          {stale ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : null}
          {holdingsCount} holdings · {formatRelativeSync(lastSyncAt)}
          {stale ? ' · stale' : ''}
        </p>
      </div>
      {children ? <div className="mt-5 border-t border-border pt-4">{children}</div> : null}
    </header>
  )
}
