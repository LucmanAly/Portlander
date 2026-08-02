/**
 * Estimate-vs-actual row. Renders honestly for all 4 presence combinations —
 * both, estimate-only (pre-release), actual-only (no consensus baseline),
 * neither (never a fabricated 0 or blank cell).
 */
export function MetricPair({
  label,
  estimate,
  actual,
  format,
  emptyText = '—',
}: {
  label: string
  estimate?: number
  actual?: number
  format: (n: number) => string
  emptyText?: string
}) {
  const hasEstimate = estimate != null
  const hasActual = actual != null

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-medium text-ink-450">{label}</span>
      <div className="tabular flex items-baseline gap-2 text-sm">
        {hasActual ? (
          <span className="font-semibold text-ink-100">{format(actual)}</span>
        ) : hasEstimate ? (
          <span className="text-ink-400">{emptyText}</span>
        ) : (
          <span className="text-ink-500">{emptyText}</span>
        )}
        {hasEstimate ? (
          <span className="text-xs text-ink-500">est. {format(estimate)}</span>
        ) : (
          <span className="text-xs text-ink-500">no estimate available</span>
        )}
      </div>
    </div>
  )
}
