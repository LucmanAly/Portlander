export type PortfolioColumnKey =
  | 'shares'
  | 'price'
  | 'dayChange'
  | 'value'
  | 'totalGainLoss'
  | 'weight'
  | 'source'
  | 'tags'

export interface PortfolioColumnDef {
  key: PortfolioColumnKey
  label: string
  defaultVisible: boolean
}

/**
 * Ticker is intentionally not in this registry — it's always shown, always
 * first, and never reorderable. A holdings table without it is useless.
 */
export const PORTFOLIO_COLUMNS: PortfolioColumnDef[] = [
  { key: 'shares', label: 'Shares', defaultVisible: true },
  { key: 'price', label: 'Price', defaultVisible: true },
  { key: 'dayChange', label: 'Day change', defaultVisible: true },
  { key: 'value', label: 'Value', defaultVisible: true },
  { key: 'totalGainLoss', label: 'Total gain/loss', defaultVisible: true },
  { key: 'weight', label: '% of portfolio', defaultVisible: true },
  // Provenance still shows via each row's tooltip (see `provenanceTitle` in
  // PortfolioTable) — hidden by default so a 40-holding book isn't spending a
  // whole column on "Manual/CSV/Synced" tags nobody reads column-by-column.
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'tags', label: 'Tags', defaultVisible: false },
]

export const DEFAULT_COLUMN_ORDER: PortfolioColumnKey[] = PORTFOLIO_COLUMNS.map((c) => c.key)

export const PORTFOLIO_COLUMN_LABEL: Record<PortfolioColumnKey, string> = Object.fromEntries(
  PORTFOLIO_COLUMNS.map((c) => [c.key, c.label]),
) as Record<PortfolioColumnKey, string>
