export function EarningsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
          Earnings
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">
          Earnings workspace
        </h1>
        <p className="mt-1.5 text-sm text-ink-400">
          A dedicated view for what's reporting, ranked by portfolio relevance.
        </p>
      </header>

      <div className="surface-elevated rounded-2xl p-8 text-center">
        <p className="text-sm text-ink-400">
          The Earnings workspace is coming in a future update. In the meantime, the
          Today and Calendar pages already surface upcoming reports.
        </p>
      </div>
    </div>
  )
}
