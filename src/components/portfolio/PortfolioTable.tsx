import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { GripVertical, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Holding } from '@/types'
import { formatFullDate, formatMoney, formatPct } from '@/lib/format'
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

const SOURCE_DESCRIPTION: Record<Holding['source'], string> = {
  manual: 'Entered manually',
  csv: 'Imported from CSV',
  snaptrade: 'Synced from brokerage',
}

/** Per-row provenance/freshness, exposed as a plain tooltip rather than an extra icon/date column. */
function provenanceTitle(h: Holding): string {
  return `${SOURCE_DESCRIPTION[h.source]} · Updated ${formatFullDate(h.updatedAt)}`
}

export function PortfolioTable({
  holdings,
  weightBasis,
  onRemove,
  emptyMessage = 'No holdings yet.',
}: {
  holdings: Holding[]
  /** `portfolioWeightBasis(holdings)` — not the raw dollar total, so weights sum to 100% with overrides in play. */
  weightBasis: number
  onRemove: (id: string) => void
  emptyMessage?: string
}) {
  const [prefs, setPrefs] = useState(() => loadPortfolioColumnPrefs())
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState<PortfolioColumnKey | null>(null)

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

  function reorderColumn(sourceKey: PortfolioColumnKey, targetKey: PortfolioColumnKey) {
    if (sourceKey === targetKey) return
    const order = [...prefs.order]
    const sourceIndex = order.indexOf(sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) return

    order.splice(sourceIndex, 1)
    order.splice(targetIndex, 0, sourceKey)
    update({ ...prefs, order })
  }

  return (
    <div className="space-y-3">
      {/* Desktop: full configurable table. */}
      <div className="surface hidden overflow-hidden rounded-2xl sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-ink-450">
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
                    {emptyMessage}
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

      {/* Mobile: compact cards instead of a horizontally-scrolling table. Always
          shows the same fixed field set — column customization is a desktop-only
          affordance, not worth reproducing in a one-column layout. */}
      <div className="space-y-2 sm:hidden">
        {holdings.length === 0 ? (
          <p className="surface rounded-2xl px-4 py-10 text-center text-sm text-ink-500">
            {emptyMessage}
          </p>
        ) : (
          holdings.map((h) => (
            <HoldingCard
              key={h.id}
              holding={h}
              weightBasis={weightBasis}
              onRemove={() => onRemove(h.id)}
            />
          ))
        )}
      </div>

      {/* Column customization stays below the table so the opening view is table-first. */}
      <div className="hidden justify-end sm:flex">
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
        <div className="surface-elevated hidden space-y-3 rounded-2xl p-4 sm:block">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-100">Column layout</h3>
              <p className="mt-1 text-xs text-ink-500">
                Drag rows to reorder the desktop table. Toggle a column off to hide it.
              </p>
            </div>
            <span className="rounded-full bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-450 ring-1 ring-border">
              Drag and drop
            </span>
          </div>
          <div
            role="list"
            aria-label="Portfolio column order"
            className="space-y-1.5"
          >
            {prefs.order.map((key) => {
              const visible = prefs.visible.includes(key)
              return (
                <div
                  key={key}
                  role="listitem"
                  aria-label={PORTFOLIO_COLUMN_LABEL[key]}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggedColumn(key)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedColumn) reorderColumn(draggedColumn, key)
                    setDraggedColumn(null)
                  }}
                  onDragEnd={() => setDraggedColumn(null)}
                  className={clsx(
                    'flex cursor-grab items-center gap-3 rounded-lg px-2 py-2 ring-1 ring-border transition active:cursor-grabbing',
                    draggedColumn === key
                      ? 'bg-accent-glow opacity-50'
                      : 'bg-ink-900/40 hover:bg-ink-800/70',
                  )}
                >
                  <GripVertical
                    className="h-4 w-4 shrink-0 text-ink-500"
                    aria-hidden="true"
                  />
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-200">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleVisible(key)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="truncate">{PORTFOLIO_COLUMN_LABEL[key]}</span>
                  </label>
                  <span className="shrink-0 text-[10px] font-medium text-ink-450">
                    {visible ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

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
            {/* Drive-by fix: this bar used an undocumented ×3 saturation
                (100% width at ~33% weight), silently inflating small
                positions on screen. Plain min(100, weight) now. */}
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${Math.min(100, weight)}%` }}
            />
          </div>
          <span className="tabular text-ink-200">{formatPct(weight)}</span>
        </div>
      )
    case 'source':
      return (
        <span
          className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] font-medium text-ink-300 ring-1 ring-border"
          title={provenanceTitle(h)}
        >
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

function HoldingCard({
  holding: h,
  weightBasis,
  onRemove,
}: {
  holding: Holding
  weightBasis: number
  onRemove: () => void
}) {
  const weight = positionWeightPct(h, weightBasis)
  const value = holdingMarketValue(h)
  const estimated = isEstimatedValue(h)
  const dayChange = holdingDayChange(h)
  const totalGain = holdingTotalGainLoss(h)

  return (
    <div className="surface-elevated rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-accent-400">{h.ticker}</span>
            <span
              className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300 ring-1 ring-border"
              title={provenanceTitle(h)}
            >
              {SOURCE_LABEL[h.source]}
            </span>
          </div>
          {h.name ? <div className="truncate text-xs text-ink-500">{h.name}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${h.ticker} from your holdings?`)) onRemove()
          }}
          className="focus-ring shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-800 hover:text-critical"
          aria-label={`Remove ${h.ticker}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <div className="text-[10px] text-ink-450">Shares</div>
          <div className="tabular text-ink-200">{h.shares}</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-450">Value</div>
          <div
            className="tabular font-medium text-ink-100"
            title={estimated ? 'Estimated from cost basis — no live price yet' : undefined}
          >
            {estimated ? '~' : ''}
            {formatMoney(value)}
          </div>
        </div>
        {dayChange != null ? (
          <div>
            <div className="text-[10px] text-ink-450">Day change</div>
            <GainLoss value={dayChange} pct={h.dayChangePct} />
          </div>
        ) : null}
        {totalGain != null ? (
          <div>
            <div className="text-[10px] text-ink-450">Total gain/loss</div>
            <GainLoss value={totalGain} pct={holdingTotalGainLossPct(h)} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-accent-500"
            style={{ width: `${Math.min(100, weight)}%` }}
          />
        </div>
        <span className="tabular text-xs text-ink-300">{formatPct(weight)} of portfolio</span>
      </div>
    </div>
  )
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
