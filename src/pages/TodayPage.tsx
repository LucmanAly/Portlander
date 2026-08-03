import { MorningHeader } from '@/components/today/MorningHeader'
import { EarningsDeck } from '@/components/today/EarningsDeck'
import { NeedsAttention, needsAttentionEvents } from '@/components/today/NeedsAttention'
import { ForwardExposurePanel } from '@/components/exposure/ForwardExposurePanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceSummaryCard } from '@/components/performance/PerformanceSummaryCard'
import { usePortfolio } from '@/context/PortfolioContext'
import {
  portfolioDayChange,
  portfolioDayChangePct,
  portfolioTotalValue,
  scoreAndFilterEvents,
} from '@/lib/scoring'
import { selectDeckCards } from '@/lib/todayDeck'
import { liveDailyPerformance, newYorkMarketDate, preferredPerformanceWindow } from '@/lib/performance'
import { generatePerformanceNarrative, loadSnapshotPerformance } from '@/lib/performanceRepository'
import { addDays, startOfDay, subDays } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import type { GeneratedPerformanceNarrative, PerformanceSummary } from '@/types/performance'

export function TodayPage() {
  const { events, holdings, watchlist, upcoming14, exposure, lastSyncAt, quotesLastSyncedAt, backend, user } = usePortfolio()
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
  const briefingWindow = useMemo(() => preferredPerformanceWindow(), [])
  const liveBriefing = useMemo(() => {
    if (
      backend === 'supabase' &&
      (!quotesLastSyncedAt || newYorkMarketDate(quotesLastSyncedAt) !== briefingWindow.endDate)
    ) {
      return null
    }
    return liveDailyPerformance(holdings, briefingWindow.endDate)
  }, [backend, briefingWindow.endDate, holdings, quotesLastSyncedAt])
  const [storedBriefing, setStoredBriefing] = useState<PerformanceSummary | null>(null)
  const [briefingNarrative, setBriefingNarrative] = useState<GeneratedPerformanceNarrative | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(briefingWindow.kind === 'week')
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const briefing = briefingWindow.kind === 'day' ? liveBriefing : storedBriefing

  useEffect(() => {
    let cancelled = false
    if (briefingWindow.kind !== 'week') return
    if (backend !== 'supabase' || !user) {
      setBriefingLoading(false)
      return
    }
    void loadSnapshotPerformance(user.id, briefingWindow.startDate, briefingWindow.endDate, holdings).then((result) => {
      if (cancelled) return
      setStoredBriefing(result.summary)
      setBriefingError(result.error)
      setBriefingLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [backend, briefingWindow.endDate, briefingWindow.kind, briefingWindow.startDate, holdings, user])

  useEffect(() => {
    let cancelled = false
    setBriefingNarrative(null)
    if (!briefing || briefing.coverage !== 'complete' || backend !== 'supabase') return
    void generatePerformanceNarrative(briefing).then((result) => {
      if (!cancelled && result.narrative) setBriefingNarrative(result.narrative)
    })
    return () => {
      cancelled = true
    }
  }, [backend, briefing])

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
      />

      <PerformanceSummaryCard
        title={briefingWindow.kind === 'day' ? "Today’s market movement" : 'This week in your portfolio'}
        summary={briefing}
        narrative={briefingNarrative}
        loading={briefingLoading}
        error={briefingError}
      />

      <EarningsDeck cards={deckCards} />

      <NeedsAttention events={attentionEvents} />

      <ForwardExposurePanel exposure={exposure} />
    </div>
  )
}
