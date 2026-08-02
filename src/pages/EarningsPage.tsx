import { useMemo, useState } from 'react'
import { usePortfolio } from '@/context/PortfolioContext'
import { scoreAndFilterEvents, sortEventsByDate } from '@/lib/scoring'
import { buildEarningsCards } from '@/lib/earningsIntel'
import { groupEarningsCards } from '@/lib/earningsGrouping'
import { EarningsStatusFilter, filterEarningsByStatus, type EarningsStatusFilterValue } from '@/components/earnings/EarningsStatusFilter'
import { EarningsReportCard } from '@/components/earnings/EarningsReportCard'
import { EarningsDetailDrawer } from '@/components/earnings/EarningsDetailDrawer'
import { ForwardExposurePanel } from '@/components/exposure/ForwardExposurePanel'
import { SortToggle, type SortMode } from '@/components/today/SortToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { addDays, startOfDay, subDays } from 'date-fns'

// Wide enough to catch "recently reported" (7-day lookback, with margin) and
// a healthy forward window of upcoming reports without duplicating Today's
// tighter D-1..D+1 focus.
const LOOKBACK_DAYS = 14
const LOOKAHEAD_DAYS = 60

export function EarningsPage() {
  const { events, holdings, watchlist, exposure } = usePortfolio()
  const [filter, setFilter] = useState<EarningsStatusFilterValue>('all')
  const [sortMode, setSortMode] = useState<SortMode>('impact')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const today = startOfDay(new Date())

  const allCards = useMemo(() => {
    const scored = scoreAndFilterEvents(events, holdings, watchlist, {
      fromDate: subDays(today, LOOKBACK_DAYS),
      toDate: addDays(today, LOOKAHEAD_DAYS),
      today,
      filter: 'earnings',
    })
    return buildEarningsCards(scored, today, events)
  }, [events, holdings, watchlist, today])

  const filtered = useMemo(() => filterEarningsByStatus(allCards, filter, today), [allCards, filter, today])

  const sorted = useMemo(
    () => (sortMode === 'impact' ? filtered : sortEventsByDate(filtered)),
    [filtered, sortMode],
  )

  const groups = useMemo(() => groupEarningsCards(sorted), [sorted])
  const selectedCard = allCards.find((c) => c.id === selectedCardId) ?? null

  if (holdings.length === 0) {
    return (
      <EmptyState
        title="Add holdings to populate Earnings"
        description="Import a CSV or enter positions manually. Earnings reports will be ranked by how much of your portfolio is on the line."
        ctaLabel="Go to Portfolio"
        ctaTo="/portfolio"
      />
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">Earnings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Earnings workspace</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Everything reporting, ranked by portfolio relevance — before and after results.
        </p>
      </header>

      <ForwardExposurePanel exposure={exposure} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EarningsStatusFilter value={filter} onChange={setFilter} />
        <div className="flex items-center gap-2.5">
          <p className="text-xs text-ink-450">
            <span className="tabular text-ink-300">{sorted.length}</span> reports
          </p>
          <SortToggle value={sortMode} onChange={setSortMode} />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="surface rounded-2xl px-6 py-12 text-center">
          <p className="text-ink-300">No reports match this filter.</p>
          <p className="mt-1 text-sm text-ink-450">Try All, or check back closer to the next report.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-sm font-semibold text-ink-450">{group.heading}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.cards.map((card) => (
                  <EarningsReportCard
                    key={card.id}
                    card={card}
                    variant="compact"
                    selected={card.id === selectedCardId}
                    onSelect={() => setSelectedCardId(card.id === selectedCardId ? null : card.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EarningsDetailDrawer card={selectedCard} onClose={() => setSelectedCardId(null)} />
    </div>
  )
}
