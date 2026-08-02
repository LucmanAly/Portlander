import { MorningHeader } from '@/components/today/MorningHeader'
import { EarningsDeck } from '@/components/today/EarningsDeck'
import { NeedsAttention, needsAttentionEvents } from '@/components/today/NeedsAttention'
import { ForwardExposurePanel } from '@/components/exposure/ForwardExposurePanel'
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
import { Link } from 'react-router-dom'

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
  const deckCards = useMemo(() => selectDeckCards(deckEvents, today), [deckEvents, today])
  const attentionEvents = useMemo(() => needsAttentionEvents(upcoming14), [upcoming14])

  const totalValue = portfolioTotalValue(holdings)
  const dayChange = portfolioDayChange(holdings)
  const dayChangePct = portfolioDayChangePct(holdings)

  if (holdings.length === 0) {
    return <EmptyHoldings />
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

      <EarningsDeck cards={deckCards} />

      <NeedsAttention events={attentionEvents} />

      <ForwardExposurePanel exposure={exposure} />
    </div>
  )
}

function EmptyHoldings() {
  return (
    <div className="surface-elevated rounded-2xl px-6 py-14 text-center">
      <h2 className="text-xl font-semibold text-ink-100">Add holdings to populate your radar</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
        Import a CSV or enter positions manually. Portlander will rank earnings and macro events by
        how much of your portfolio is on the line.
      </p>
      <Link
        to="/portfolio"
        className="focus-ring mt-6 inline-flex rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
      >
        Go to Portfolio
      </Link>
    </div>
  )
}
