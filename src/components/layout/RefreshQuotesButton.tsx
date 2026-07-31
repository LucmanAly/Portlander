import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw } from 'lucide-react'
import { usePortfolio } from '@/context/PortfolioContext'
import { formatRelativeShort } from '@/lib/format'

/**
 * Persistent, manual-only live price refresh. Never fires automatically —
 * only on click. Rendered from AppShell so it's reachable from every page
 * without per-page wiring.
 */
export function RefreshQuotesButton({ variant }: { variant: 'sidebar' | 'compact' }) {
  const { quotesSyncing, quotesLastSyncedAt, quotesError, refreshQuotes, backend } = usePortfolio()
  const gated = backend !== 'supabase'

  // Re-render every 30s so the "Updated Xm ago" caption keeps advancing
  // without needing new data.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  function onClick() {
    if (quotesSyncing) return
    void refreshQuotes()
  }

  const caption = quotesError
    ? quotesError
    : gated
      ? 'Sign in to refresh live prices'
      : formatRelativeShort(quotesLastSyncedAt)

  const icon = <RefreshCw className={clsx('h-4 w-4 shrink-0', quotesSyncing && 'animate-spin')} />

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={quotesSyncing}
        aria-label={gated ? 'Sign in to refresh live prices' : 'Refresh prices'}
        title={caption}
        className={clsx(
          'focus-ring rounded-lg p-2 transition disabled:cursor-wait',
          gated ? 'text-ink-600' : 'text-ink-300 hover:bg-ink-800/80 hover:text-accent-400',
        )}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className="surface mb-2 rounded-xl p-3">
      <button
        type="button"
        onClick={onClick}
        disabled={quotesSyncing}
        className={clsx(
          'focus-ring flex w-full items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium transition disabled:cursor-wait',
          gated ? 'text-ink-500' : 'text-ink-100 hover:text-accent-400',
        )}
      >
        {icon}
        {quotesSyncing ? 'Refreshing…' : 'Refresh prices'}
      </button>
      <p className={clsx('mt-1 px-1 text-[11px]', quotesError ? 'text-critical' : 'text-ink-500')}>
        {caption}
      </p>
    </div>
  )
}
