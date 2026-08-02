import { Sparkles } from 'lucide-react'
import type { GeneratedInterpretation } from '@/types/earnings'

/** Distinct dashed-border treatment so generated prose is never visually confused with verified facts. */
export function GeneratedInsight({ interpretation }: { interpretation?: GeneratedInterpretation }) {
  if (!interpretation) return null

  return (
    <div className="rounded-xl border border-dashed border-accent-500/30 bg-accent-glow/40 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-400">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Generated interpretation — not verified
      </div>
      <p className="text-sm leading-relaxed text-ink-200">{interpretation.summary}</p>
      {interpretation.model || interpretation.confidence ? (
        <p className="mt-1.5 text-xs text-ink-450">
          {[interpretation.model, interpretation.confidence ? `${interpretation.confidence} confidence` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
