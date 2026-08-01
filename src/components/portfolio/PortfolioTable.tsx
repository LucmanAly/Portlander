import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Holding } from '@/types'
import { formatMoney, formatPct } from '@/lib/format'
import {
  holdingDayChange,
  holdingMarketValue,
  holdingTotalGainLoss,
  holdingTotalGainLossPct,
  isEstimatedValue,
  positionWeightPct,
} from '@/lib/scoring'
import { PORTFOLIO_COLUMN_LABEL, type PortfolioColumnKey } from '@/lib/portfolioColumns'
import { loadPortfolioColumnPrefs, savePortfolioColumnPrefs } from '@/lib/tablePrefs'

const SOURCE_LABEL: Record<Holding['source'], string> = {
  manual: 'Manual',
  csv: 'CSV',
  snaptrade: 'Synced',
}

export function PortfolioTable({
  holdings,
  weightBasis,
  onRemove,
}: {
  holdings: Holding[]
  /** `portfolioWeightBasis(holdings)` — not the raw dollar total, so weights sum to 100% with overrides in play. */
  weightBasis: number
  onRemove: (id: string) => void
}) {
  const [prefs, setPrefs] = useState(() => loadPortfolioColumnPrefs())
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const orderedVisible = useMemo(
    () => prefs.order.filter((k) => prefs.visible.includes(k)),
    [prefs],
  )

  function update(next: typeof prefs) {
    setPrefs(next)
    savePortfolioColumnPrefs(next)
  }

  function toggleVisible(key: PortfolioColumnKey) {
    const visible = prefs.visible.includes(key)
      ? prefs.visible.filter((k) => k !== key)
      : [...prefs.visible, key]
    update({ ...prefs, visible })
  }

  function moveColumn(key: PortfolioColumnKey, direction: -1 | 1) {
    const order = [...prefs.order]
    const i = order.indexOf(key)
    const j = i + direction
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    update({ ...prefs, order })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCustomizeOpen((v) => !v)}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Customize columns
        </button>
      </div>

      {customizeOpen ? (
        <div className="surface-elevated space-y-2 rounded-2xl p-4">
          {prefs.order.map((key) => {
            const visible = prefs.visible.includes(key)
            const i = prefs.order.indexOf(key)
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-800/50"
              >
                <label className="flex flex-1 items-center gap-2 text-sm text-ink-200">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleVisible(key)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {PORTFOLIO_COLUMN_LABEL[key]}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${PORTFOLIO_COLUMN_LABEL[key]} left`}
                    onClick={() => moveColumn(key, -1)}
                    disabled={i === 0}
                    className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${PORTFOLIO_COLUMN_LABEL[key]} right`}
                    onClick={() => moveColumn(key, 1)}
                    disabled={i === prefs.order.length - 1}
                    className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3 font-medium">Ticker</th>
                {orderedVisible.map((key) => (
                  <th key={key} className="px-4 py-3 font-medium">
                    {PORTFOLIO_COLUMN_LABEL[key]}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={orderedVisible.length + 2} className="px-4 py-10 text-center text-ink-500">
                    No holdings yet.
                  </td>
                </tr>
              ) : (
                holdings.map((h) => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    weightBasis={weightBasis}
                    columns={orderedVisible}
                    onRemove={() => onRemove(h.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HoldingRow({
  holding: h,
  weightBasis,
  columns,
  onRemove,
}: {
  holding: Holding
  weightBasis: number
  columns: PortfolioColumnKey[]
  onRemove: () => void
}) {
  const weight = positionWeightPct(h, weightBasis)
  const value = holdingMarketValue(h)
  const estimated = isEstimatedValue(h)

  return (
    <tr className="hover:bg-ink-800/30">
      <td className="px-4 py-3">
        <div className="font-semibold text-accent-400">{h.ticker}</div>
        {h.name ? <div className="text-xs text-ink-500">{h.name}</div> : null}
      </td>
      {columns.map((key) => (
        <td key={key} className="px-4 py-3">
          <Cell columnKey={key} holding={h} weight={weight} value={value} estimated={estimated} />
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${h.ticker} from your holdings?`)) onRemove()
          }}
          className="focus-ring rounded-lg p-2 text-ink-500 hover:bg-ink-800 hover:text-critical"
          aria-label={`Remove ${h.ticker}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  )
}

function Cell({
  columnKey,
  holding: h,
  weight,
  value,
  estimated,
}: {
  columnKey: PortfolioColumnKey
  holding: Holding
  weight: number
  value: number
  estimated: boolean
}) {
  switch (columnKey) {
    case 'shares':
      return <span className="tabular text-ink-200">{h.shares}</span>
    case 'price':
      return (
        <span className="tabular text-ink-300">
          {h.lastPrice != null ? formatMoney(h.lastPrice) : '—'}
        </span>
      )
    case 'dayChange': {
      const change = holdingDayChange(h)
      if (change == null) return <span className="text-ink-500">—</span>
      return <GainLoss value={change} pct={h.dayChangePct} />
    }
    case 'value':
      return (
        <span
          className="tabular font-medium text-ink-100"
          title={estimated ? 'Estimated from cost basis — no live price yet' : undefined}
        >
          {estimated ? '~' : ''}
          {formatMoney(value)}
        </span>
      )
    case 'totalGainLoss': {
      const gain = holdingTotalGainLoss(h)
      if (gain == null) return <span className="text-ink-500">—</span>
      return <GainLoss value={gain} pct={holdingTotalGainLossPct(h)} />
    }
    case 'weight':
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${Math.min(100, weight * 3)}%` }}
            />
          </div>
          <span className="tabular text-ink-200">{formatPct(weight)}</span>
        </div>
      )
    case 'source':
      return (
        <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] font-medium text-ink-300 ring-1 ring-border">
          {SOURCE_LABEL[h.source]}
        </span>
      )
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1">
          {(h.tags ?? []).map((t) => (
            <span
              key={t}
              className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400 ring-1 ring-border"
            >
              {t}
            </span>
          ))}
        </div>
      )
    default:
      return null
  }
}

function GainLoss({ value, pct }: { value: number; pct?: number }) {
  const positive = value >= 0
  return (
    <span className={clsx('tabular font-medium', positive ? 'text-positive' : 'text-critical')}>
      {positive ? '+' : ''}
      {formatMoney(value)}
      {pct != null ? ` (${positive ? '+' : ''}${formatPct(pct)})` : ''}
    </span>
  )
}
