import { MorningHeader } from '@/components/today/MorningHeader'
import { EarningsDeck } from '@/components/today/EarningsDeck'
import { NeedsAttention, needsAttentionEvents } from '@/components/today/NeedsAttention'
import { ForwardExposurePanel } from '@/components/exposure/ForwardExposurePanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { MorningPerformanceRecap } from '@/components/performance/MorningPerformanceRecap'
import { usePortfolio } from '@/context/PortfolioContext'
import {
  portfolioDayChange,
  portfolioDayChangePct,
  portfolioTotalValue,
  scoreAndFilterEvents,
} from '@/lib/scoring'
import { selectDeckCards } from '@/lib/todayDeck'
import { addDays, startOfDay, subDays } from 'date-fns'
import { useMemo } from 'react'

export function TodayPage() {
  const { events, holdings, watchlist, upcoming14, exposure, lastSyncAt } = usePortfolio()
  const today = startOfDay(new Date())

  const deckEvents = useMemo(
    () =>
      scoreAndFilterEvents(events, holdings, watchlist, {
        fromDate: subDays(today, 1),
        toDate: addDays(today, 1),
        today,
        filter: 'earnings',
      }),
    [events, holdings, watchlist, today],
  )
  const deckCards = useMemo(() => selectDeckCards(deckEvents, today, events), [deckEvents, today, events])
  const attentionEvents = useMemo(() => needsAttentionEvents(upcoming14), [upcoming14])

  const totalValue = portfolioTotalValue(holdings)
  const dayChange = portfolioDayChange(holdings)
  const dayChangePct = portfolioDayChangePct(holdings)

  if (holdings.length === 0) {
    return (
      <EmptyState
        title="Add holdings to populate your radar"
        description="Import a CSV or enter positions manually. Portlander will rank earnings and macro events by how much of your portfolio is on the line."
        ctaLabel="Go to Portfolio"
        ctaTo="/portfolio"
      />
    )
  }

  return (
    <div className="space-y-6">
      <MorningHeader
        totalValue={totalValue}
        dayChange={dayChange}
        dayChangePct={dayChangePct}
        lastSyncAt={lastSyncAt}
        holdingsCount={holdings.length}
      >
        <MorningPerformanceRecap />
      </MorningHeader>

      <EarningsDeck cards={deckCards} />

      <NeedsAttention events={attentionEvents} />

      <ForwardExposurePanel exposure={exposure} />
    </div>
  )
}
