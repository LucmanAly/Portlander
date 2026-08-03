import { useEffect, useMemo, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { usePortfolio } from '@/context/PortfolioContext'
import { buildLiveDaySummary, buildSnapshotSummary } from '@/lib/performance'
import { loadPerformanceSnapshots } from '@/lib/portfolioRepository'
import { PerformanceRecapCard } from '@/components/performance/PerformanceRecapCard'
import type { PerformanceSummary } from '@/types/performance'

export function MorningPerformanceRecap() {
  const { holdings, backend, user } = usePortfolio()
  const now = new Date()
  const weekend = now.getDay() === 0 || now.getDay() === 6
  const today = format(now, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const liveSummary = useMemo(() => buildLiveDaySummary(holdings, today), [holdings, today])
  const [weekSummary, setWeekSummary] = useState<PerformanceSummary | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!weekend || backend !== 'supabase' || !user) {
      setWeekSummary(undefined)
      return
    }
    setLoading(true)
    void loadPerformanceSnapshots(weekStart, today, user.id).then(({ snapshots }) => {
      if (cancelled) return
      const currentTags = new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding.tags ?? []]))
      setWeekSummary(buildSnapshotSummary(snapshots, weekStart, today, 'week', currentTags))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [weekend, backend, user, weekStart, today, holdings])

  return (
    <PerformanceRecapCard
      title={weekend ? 'This week in your portfolio' : 'Today in your portfolio'}
      summary={weekend ? weekSummary : liveSummary}
      loading={weekend && loading}
      emptyMessage={
        weekend
          ? 'A weekly recap needs at least two complete price captures this week. Each successful Refresh prices run now records one.'
          : 'Refresh every holding’s price to calculate a truthful whole-book recap.'
      }
      enableNarrative={backend === 'supabase' && Boolean(user)}
    />
  )
}
