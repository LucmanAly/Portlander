import { Dialog } from '@/components/ui/Dialog'
import { MetricPair } from '@/components/ui/MetricPair'
import { FreshnessLabel } from '@/components/ui/FreshnessLabel'
import { EarningsStateBadge, TimingBadge } from '@/components/ui/Badge'
import { HistoricalBeatStrip } from '@/components/earnings/HistoricalBeatStrip'
import { GeneratedInsight } from '@/components/earnings/GeneratedInsight'
import type { EarningsCardModel } from '@/types/earnings'
import { formatEps, formatCompactMoney, formatEventDay, formatPct, formatSignedPct } from '@/lib/format'

/**
 * Opens on card selection: right-side drawer on desktop, bottom sheet on
 * mobile (both via Dialog). Section order is fixed: verified financials ->
 * portfolio exposure -> guidance -> source/freshness -> compact history ->
 * divider -> generated interpretation last, never blended with the facts
 * above it. Pre-release sections (actual/surprise/guidance/reaction) are
 * omitted entirely rather than rendered empty.
 */
export function EarningsDetailDrawer({
  card,
  onClose,
}: {
  card: EarningsCardModel | null
  onClose: () => void
}) {
  return (
    <Dialog open={card != null} onClose={onClose} title={card ? `${card.ticker} earnings` : 'Earnings detail'}>
      {card ? <DrawerBody card={card} /> : null}
    </Dialog>
  )
}

function DrawerBody({ card }: { card: EarningsCardModel }) {
  const facts = card.facts
  const isReported = card.viewState === 'reported'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <EarningsStateBadge state={card.viewState} />
        <TimingBadge timing={card.timing} />
      </div>

      <div>
        <p className="text-sm text-ink-300">{card.companyName ?? card.title}</p>
        <p className="mt-0.5 text-xs text-ink-450">{formatEventDay(card.eventDate)}</p>
      </div>

      <section>
        <h3 className="mb-1 text-xs font-medium text-ink-450">Financials</h3>
        <div className="divide-y divide-border/60 border-t border-border/60">
          <MetricPair
            label="EPS"
            estimate={facts?.consensus?.epsEstimate}
            actual={isReported ? facts?.actual?.epsActual : undefined}
            format={formatEps}
          />
          <MetricPair
            label="Revenue"
            estimate={facts?.consensus?.revenueEstimate}
            actual={isReported ? facts?.actual?.revenueActual : undefined}
            format={formatCompactMoney}
          />
        </div>
        {isReported && facts?.surprise ? (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {facts.surprise.epsSurprisePct != null ? (
              <span className="font-medium text-ink-300">
                EPS surprise: {formatSignedPct(facts.surprise.epsSurprisePct)}
              </span>
            ) : null}
            {facts.surprise.revenueSurprisePct != null ? (
              <span className="font-medium text-ink-300">
                Revenue surprise: {formatSignedPct(facts.surprise.revenueSurprisePct)}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-medium text-ink-450">Portfolio exposure</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-400">{card.isHolding ? 'Weight' : 'Not held'}</span>
          {card.isHolding ? <span className="tabular font-semibold text-ink-100">{formatPct(card.positionWeightPct)}</span> : null}
        </div>
      </section>

      {isReported && facts?.guidance && facts.guidance.direction !== 'none' ? (
        <section>
          <h3 className="mb-1 text-xs font-medium text-ink-450">Guidance</h3>
          <p className="text-sm text-ink-200">
            {facts.guidance.direction}
            {facts.guidance.note ? ` — ${facts.guidance.note}` : ''}
          </p>
        </section>
      ) : null}

      {isReported && facts?.reaction ? (
        <section>
          <h3 className="mb-1 text-xs font-medium text-ink-450">Reaction</h3>
          <p className="text-sm text-ink-200">
            {facts.reaction.direction}
            {facts.reaction.pricePct != null ? ` ${formatSignedPct(facts.reaction.pricePct)}` : ''}
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1 text-xs font-medium text-ink-450">Source</h3>
        <FreshnessLabel provenance={facts?.provenance} />
      </section>

      <section>
        <h3 className="mb-1 text-xs font-medium text-ink-450">History</h3>
        <HistoricalBeatStrip history={facts?.history} />
      </section>

      <div className="border-t border-border/60 pt-4">
        <GeneratedInsight interpretation={card.interpretation} />
      </div>
    </div>
  )
}
