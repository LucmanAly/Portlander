import clsx from 'clsx'
import type { HistoricalBeat } from '@/types/earnings'

function beatLabel(quarter: string, epsBeat: boolean | null, revenueBeat: boolean | null): string {
  const epsWord = epsBeat == null ? 'EPS unknown' : epsBeat ? 'EPS beat' : 'EPS missed'
  const revWord = revenueBeat == null ? 'revenue unknown' : revenueBeat ? 'revenue beat' : 'revenue missed'
  return `${quarter}: ${epsWord}, ${revWord}`
}

function dotTone(beat: boolean | null): string {
  if (beat == null) return 'bg-ink-700'
  return beat ? 'bg-positive' : 'bg-critical'
}

export function HistoricalBeatStrip({ history }: { history?: HistoricalBeat[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-ink-450">No earnings history available.</p>
  }

  const known = history.filter((h) => h.epsBeat != null)
  const beats = known.filter((h) => h.epsBeat === true).length

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-ink-400">
        {known.length > 0
          ? `${beats} of ${known.length} quarters beat EPS${
              known.length < history.length ? ` (${history.length - known.length} unknown)` : ''
            }`
          : 'No confirmed EPS history yet'}
      </p>
      <div className="flex items-center gap-1.5" role="list">
        {history.map((h) => (
          <span
            key={h.quarter}
            role="listitem"
            aria-label={beatLabel(h.quarter, h.epsBeat, h.revenueBeat)}
            title={beatLabel(h.quarter, h.epsBeat, h.revenueBeat)}
            className={clsx('h-2 w-2 rounded-full', dotTone(h.epsBeat))}
          />
        ))}
      </div>
    </div>
  )
}
