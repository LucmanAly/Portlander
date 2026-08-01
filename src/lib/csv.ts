import type { Holding } from '@/types'

function uid(): string {
  return crypto.randomUUID()
}

/**
 * Parse CSV with headers: ticker, shares, cost_basis?, last_price?, weight_pct?, name?
 * Also accepts: symbol instead of ticker; weight instead of weight_pct.
 */
export function parseHoldingsCsv(text: string): { holdings: Holding[]; errors: string[] } {
  const errors: string[] = []
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { holdings: [], errors: ['CSV is empty'] }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const tickerIdx = header.findIndex((h) => h === 'ticker' || h === 'symbol')
  const sharesIdx = header.findIndex((h) => h === 'shares' || h === 'quantity' || h === 'qty')
  const costIdx = header.findIndex((h) => h === 'cost_basis' || h === 'cost' || h === 'avg_cost')
  const priceIdx = header.findIndex((h) => h === 'last_price' || h === 'price' || h === 'last')
  const weightIdx = header.findIndex((h) => h === 'weight_pct' || h === 'weight' || h === 'pct')
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'company')

  if (tickerIdx < 0 || sharesIdx < 0) {
    return {
      holdings: [],
      errors: ['CSV must include ticker (or symbol) and shares columns'],
    }
  }

  const now = new Date().toISOString()
  const holdings: Holding[] = []
  const seen = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const ticker = (cols[tickerIdx] ?? '').trim().toUpperCase()
    const shares = Number(String(cols[sharesIdx] ?? '').replace(/,/g, ''))
    if (!ticker) {
      errors.push(`Row ${i + 1}: missing ticker`)
      continue
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      errors.push(`Row ${i + 1} (${ticker}): invalid shares`)
      continue
    }
    if (seen.has(ticker)) {
      errors.push(`Row ${i + 1}: duplicate ${ticker} skipped`)
      continue
    }
    seen.add(ticker)

    const costBasis =
      costIdx >= 0 && cols[costIdx] ? Number(String(cols[costIdx]).replace(/,/g, '')) : undefined
    const lastPrice =
      priceIdx >= 0 && cols[priceIdx]
        ? Number(String(cols[priceIdx]).replace(/,/g, ''))
        : undefined
    const weightOverridePct =
      weightIdx >= 0 && cols[weightIdx]
        ? Number(String(cols[weightIdx]).replace(/%/g, ''))
        : undefined
    const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : undefined

    holdings.push({
      id: uid(),
      ticker,
      name: name || undefined,
      shares,
      costBasis: Number.isFinite(costBasis) ? costBasis : undefined,
      lastPrice: Number.isFinite(lastPrice) ? lastPrice : undefined,
      weightOverridePct: Number.isFinite(weightOverridePct) ? weightOverridePct : undefined,
      source: 'csv',
      createdAt: now,
      updatedAt: now,
    })
  }

  return { holdings, errors }
}

export interface CsvImportPlan {
  /** The full holdings list to persist. */
  next: Holding[]
  /** Rows from the CSV that will be written. */
  imported: number
  /** Brokerage-synced rows carried through untouched. */
  protectedSynced: number
  /** CSV rows dropped because a brokerage sync already owns that ticker. */
  skipped: number
}

/**
 * Fold a parsed CSV into the current book.
 *
 * A CSV describes manual holdings; it says nothing about what the brokerage
 * reports. So `source='snaptrade'` rows are carried through untouched and any
 * CSV row naming a ticker the brokerage already owns is dropped rather than
 * competing with it. Everything else the CSV replaces wholesale.
 *
 * Kept here rather than in the page so the rule that protects live positions is
 * testable on its own.
 */
export function planCsvImport(existing: Holding[], parsed: Holding[]): CsvImportPlan {
  const synced = existing.filter((h) => h.source === 'snaptrade')
  const syncedTickers = new Set(synced.map((h) => h.ticker.toUpperCase()))
  const imported = parsed.filter((h) => !syncedTickers.has(h.ticker.toUpperCase()))

  return {
    next: [...synced, ...imported],
    imported: imported.length,
    protectedSynced: synced.length,
    skipped: parsed.length - imported.length,
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function holdingsToCsv(holdings: Holding[]): string {
  const header = 'ticker,name,shares,cost_basis,last_price,weight_pct'
  const rows = holdings.map((h) =>
    [
      h.ticker,
      csvEscape(h.name ?? ''),
      h.shares,
      h.costBasis ?? '',
      h.lastPrice ?? '',
      h.weightOverridePct ?? '',
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
