import { usePortfolio } from '@/context/PortfolioContext'
import { formatMoney } from '@/lib/format'
import { portfolioTotalValue, positionWeightPct } from '@/lib/scoring'
import { holdingsToCsv, parseHoldingsCsv, planCsvImport } from '@/lib/csv'
import { PortfolioTable } from '@/components/portfolio/PortfolioTable'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'

export function PortfolioPage() {
  const {
    holdings,
    watchlist,
    addHolding,
    removeHolding,
    replaceHoldings,
    addWatchlist,
    removeWatchlist,
  } = usePortfolio()

  const total = portfolioTotalValue(holdings)
  const sorted = useMemo(
    () =>
      [...holdings].sort(
        (a, b) => positionWeightPct(b, total) - positionWeightPct(a, total),
      ),
    [holdings, total],
  )

  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [name, setName] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvInfo, setCsvInfo] = useState<string | null>(null)
  const [watchTicker, setWatchTicker] = useState('')

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
      const plan = planCsvImport(holdings, parsed)
      replaceHoldings(plan.next)
      setCsvInfo(
        [
          `Imported ${plan.imported} holdings`,
          plan.protectedSynced ? `${plan.protectedSynced} brokerage-synced rows protected` : null,
          plan.skipped
            ? `${plan.skipped} row(s) skipped — already synced from your brokerage`
            : null,
          errors.length ? `${errors.length} warnings` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      if (errors.length) setCsvError(errors.slice(0, 3).join('; '))
    }
    reader.readAsText(file)
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
            Portfolio
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Holdings</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Weights drive event impact. Use last price or cost basis for market value.
          </p>
        </div>
        <div className="tabular text-right">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Total value</div>
          <div className="text-2xl font-semibold text-ink-100">{formatMoney(total)}</div>
        </div>
      </header>

      {/* Import / export */}
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

      {/* Add form */}
      <form
        onSubmit={onAdd}
        className="surface-elevated grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-5"
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

      <PortfolioTable holdings={sorted} total={total} onRemove={removeHolding} />

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  )
}
