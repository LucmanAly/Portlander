import { usePortfolio } from '@/context/PortfolioContext'
import { formatMoney } from '@/lib/format'
import {
  holdingMarketValue,
  portfolioDayChange,
  portfolioDayChangePct,
  portfolioTotalValue,
  portfolioWeightBasis,
  positionWeightPct,
} from '@/lib/scoring'
import { holdingsToCsv, parseHoldingsCsv, planCsvImport, type CsvImportMode } from '@/lib/csv'
import { PortfolioTable } from '@/components/portfolio/PortfolioTable'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Download, Search, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import type { Holding, HoldingSource } from '@/types'

type SortKey = 'weight' | 'ticker' | 'value' | 'dayChange'

const SOURCE_FILTERS: { id: HoldingSource | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'manual', label: 'Manual' },
  { id: 'csv', label: 'CSV' },
  { id: 'snaptrade', label: 'Synced' },
]

const SORT_LABEL: Record<SortKey, string> = {
  weight: '% of portfolio',
  ticker: 'Ticker',
  value: 'Value',
  dayChange: 'Day change',
}

export function PortfolioPage() {
  const {
    holdings,
    watchlist,
    addHolding,
    removeHolding,
    applyCsvImport,
    addWatchlist,
    removeWatchlist,
  } = usePortfolio()

  // Two different totals: `total` is the raw dollar sum for the header display;
  // `weightBasis` is what weight percentages should actually divide by, so a
  // book mixing weight overrides and computed weights still sums to 100%.
  const total = portfolioTotalValue(holdings)
  const weightBasis = portfolioWeightBasis(holdings)
  const dayChange = portfolioDayChange(holdings)
  const dayChangePct = portfolioDayChangePct(holdings)
  const dayChangeClass =
    dayChange == null ? 'text-ink-300' : dayChange >= 0 ? 'text-positive' : 'text-critical'

  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<HoldingSource | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('weight')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return holdings.filter((h) => {
      if (sourceFilter !== 'all' && h.source !== sourceFilter) return false
      if (!q) return true
      return h.ticker.toLowerCase().includes(q) || (h.name ?? '').toLowerCase().includes(q)
    })
  }, [holdings, search, sourceFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    switch (sortKey) {
      case 'ticker':
        return list.sort((a, b) => a.ticker.localeCompare(b.ticker))
      case 'value':
        return list.sort((a, b) => holdingMarketValue(b) - holdingMarketValue(a))
      case 'dayChange':
        return list.sort((a, b) => (b.dayChangePct ?? -Infinity) - (a.dayChangePct ?? -Infinity))
      case 'weight':
      default:
        return list.sort(
          (a, b) => positionWeightPct(b, weightBasis) - positionWeightPct(a, weightBasis),
        )
    }
  }, [filtered, sortKey, weightBasis])

  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [name, setName] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvInfo, setCsvInfo] = useState<string | null>(null)
  const [watchTicker, setWatchTicker] = useState('')
  const [pendingCsv, setPendingCsv] = useState<{ parsed: Holding[]; errors: string[] } | null>(
    null,
  )
  const [csvMode, setCsvMode] = useState<CsvImportMode>('merge')

  const csvPlan = useMemo(
    () => (pendingCsv ? planCsvImport(holdings, pendingCsv.parsed, csvMode) : null),
    [pendingCsv, holdings, csvMode],
  )

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    const s = Number(shares)
    if (!t || !Number.isFinite(s) || s <= 0) return
    addHolding({
      ticker: t,
      name: name.trim() || undefined,
      shares: s,
      lastPrice: price ? Number(price) : undefined,
      source: 'manual',
    })
    setTicker('')
    setShares('')
    setPrice('')
    setName('')
  }

  function onCsv(file: File) {
    setCsvError(null)
    setCsvInfo(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { holdings: parsed, errors } = parseHoldingsCsv(text)
      if (parsed.length === 0) {
        setCsvError(errors[0] ?? 'No holdings parsed')
        return
      }
      setCsvMode('merge')
      setPendingCsv({ parsed, errors })
    }
    reader.readAsText(file)
  }

  function confirmCsvImport() {
    if (!pendingCsv || !csvPlan) return
    if (csvPlan.replaced > 0 && !confirm(`Replace will remove ${csvPlan.replaced} existing holding(s) not in this CSV. Continue?`)) {
      return
    }
    applyCsvImport(csvPlan)
    setCsvInfo(
      [
        `${csvMode === 'replace' ? 'Replaced with' : 'Merged'} ${csvPlan.imported} holdings`,
        csvPlan.replaced ? `${csvPlan.replaced} row(s) removed` : null,
        csvPlan.protectedSynced
          ? `${csvPlan.protectedSynced} brokerage-synced rows protected`
          : null,
        csvPlan.skipped
          ? `${csvPlan.skipped} row(s) skipped — already synced from your brokerage`
          : null,
        pendingCsv.errors.length ? `${pendingCsv.errors.length} warnings` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    )
    if (pendingCsv.errors.length) setCsvError(pendingCsv.errors.slice(0, 3).join('; '))
    setPendingCsv(null)
  }

  function cancelCsvImport() {
    setPendingCsv(null)
  }

  function exportCsv() {
    const blob = new Blob([holdingsToCsv(holdings)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'portlander-holdings.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
            Portfolio
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Holdings</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Your holdings and today’s move at a glance. Management tools live below the table.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
          <SummaryMetric label="Total value" value={formatMoney(total)} />
          <SummaryMetric
            label="Today’s change"
            value={dayChange == null ? '—' : `${dayChange >= 0 ? '+' : ''}${formatMoney(dayChange)}`}
            detail={
              dayChangePct == null
                ? 'Refresh prices to calculate'
                : `${dayChangePct >= 0 ? '+' : ''}${formatPct(dayChangePct)} today`
            }
            valueClassName={dayChangeClass}
          />
        </div>
      </header>      <PortfolioTable
        holdings={sorted}
        weightBasis={weightBasis}
        onRemove={removeHolding}
        emptyMessage={
          holdings.length === 0
            ? 'No holdings yet.'
            : 'No holdings match your search/filter.'
        }
      />

      <section
        aria-labelledby="manage-holdings"
        className="surface-elevated space-y-5 rounded-2xl p-5"
      >
        <div>
          <h2 id="manage-holdings" className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Manage holdings
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Import, add, search, filter, and sort your book here. These controls stay below the
            table so the portfolio opens on the information that matters most.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750">
            <Upload className="h-4 w-4" />
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onCsv(f)
                e.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={holdings.length === 0}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {csvInfo ? <p className="text-sm text-accent-400">{csvInfo}</p> : null}
        {csvError ? <p className="text-sm text-critical">{csvError}</p> : null}
        <p className="text-xs text-ink-500">
          CSV headers: <code className="text-ink-400">ticker, shares, last_price, cost_basis, weight_pct, name</code>
        </p>

        {pendingCsv && csvPlan ? (
          <div className="surface space-y-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-100">Import preview</h3>
                <p className="mt-1 text-xs text-ink-500">
                  Review the changes before writing them to your portfolio.
                </p>
              </div>
              <div className="flex gap-1 rounded-lg bg-ink-900 p-1">
                {(['merge', 'replace'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCsvMode(mode)}
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                      csvMode === mode
                        ? 'bg-accent-500 text-ink-950'
                        : 'text-ink-400 hover:text-ink-200',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-ink-500">
              {csvMode === 'merge'
                ? 'Adds or updates CSV rows by ticker. Existing rows the CSV does not mention stay unchanged.'
                : 'CSV rows replace existing manual and CSV rows. Brokerage-synced rows are protected.'}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-ink-500">Imported</dt>
                <dd className="tabular font-medium text-ink-100">{csvPlan.imported}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Removed</dt>
                <dd className={clsx('tabular font-medium', csvPlan.replaced ? 'text-critical' : 'text-ink-100')}>
                  {csvPlan.replaced}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Synced protected</dt>
                <dd className="tabular font-medium text-ink-100">{csvPlan.protectedSynced}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Skipped</dt>
                <dd className="tabular font-medium text-ink-100">{csvPlan.skipped}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmCsvImport}
                className="focus-ring rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-400"
              >
                Confirm {csvMode}
              </button>
              <button
                type="button"
                onClick={cancelCsvImport}
                className="focus-ring rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={onAdd}
          className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="Ticker">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="CRWD"
              className="input"
              required
            />
          </Field>
          <Field label="Shares">
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              type="number"
              min="0"
              step="any"
              placeholder="40"
              className="input"
              required
            />
          </Field>
          <Field label="Last price">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="any"
              placeholder="312"
              className="input"
            />
          </Field>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CrowdStrike"
              className="input"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              className="focus-ring w-full rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-400"
            >
              Add / update
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <label className="focus-ring flex min-w-[200px] flex-1 items-center gap-2 rounded-xl bg-ink-850 px-3 py-2 ring-1 ring-border">
            <Search className="h-4 w-4 shrink-0 text-ink-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or name"
              className="w-full bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSourceFilter(f.id)}
                className={clsx(
                  'focus-ring rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150',
                  sourceFilter === f.id
                    ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/40'
                    : 'bg-ink-850 text-ink-400 ring-1 ring-border hover:text-ink-200',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-400">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="input w-auto"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Watchlist */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-100">Watchlist</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (watchTicker.trim()) {
              addWatchlist(watchTicker.trim())
              setWatchTicker('')
            }
          }}
        >
          <input
            value={watchTicker}
            onChange={(e) => setWatchTicker(e.target.value)}
            placeholder="Add ticker"
            className="input max-w-[160px]"
          />
          <button
            type="submit"
            className="focus-ring rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border"
          >
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {watchlist.length === 0 ? (
            <p className="text-sm text-ink-500">No watchlist tickers.</p>
          ) : (
            watchlist.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-2 rounded-lg bg-ink-850 px-3 py-1.5 text-sm ring-1 ring-border"
              >
                <span className="font-medium text-accent-400">{w.ticker}</span>
                {w.name ? <span className="text-ink-500">{w.name}</span> : null}
                <button
                  type="button"
                  className="text-ink-500 hover:text-critical"
                  onClick={() => removeWatchlist(w.id)}
                  aria-label={`Remove ${w.ticker}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
  valueClassName = 'text-ink-100',
}: {
  label: string
  value: string
  detail?: string
  valueClassName?: string
}) {
  return (
    <div className="surface-elevated min-w-0 rounded-2xl px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={clsx('mt-1 truncate text-xl font-semibold tabular', valueClassName)}>{value}</div>
      {detail ? <div className="mt-0.5 truncate text-xs text-ink-500">{detail}</div> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  )
}
