import { AlertTriangle } from 'lucide-react'
import type { ProvenanceInfo } from '@/types/earnings'
import { formatRelativeShort } from '@/lib/format'

export function FreshnessLabel({ provenance }: { provenance?: ProvenanceInfo }) {
  if (!provenance) {
    return <span className="text-xs text-ink-450">Source unknown</span>
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-450">
      <span>
        {provenance.source} · {formatRelativeShort(provenance.fetchedAt ?? null)}
      </span>
      {provenance.isEstimateFallback ? (
        <span
          className="inline-flex items-center gap-0.5 text-earnings"
          title="Estimated — not an observed value"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Estimated, not observed</span>~
        </span>
      ) : null}
    </span>
  )
}
