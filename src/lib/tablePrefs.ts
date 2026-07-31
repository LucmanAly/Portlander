import type { PortfolioColumnKey } from '@/lib/portfolioColumns'
import { DEFAULT_COLUMN_ORDER, PORTFOLIO_COLUMNS } from '@/lib/portfolioColumns'

const KEY = 'portlander.portfolioColumns.v1'

export interface PortfolioColumnPrefs {
  visible: PortfolioColumnKey[]
  order: PortfolioColumnKey[]
}

function defaultPrefs(): PortfolioColumnPrefs {
  return {
    visible: PORTFOLIO_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
    order: [...DEFAULT_COLUMN_ORDER],
  }
}

/** Cross-device sync of this preference is a fast-follow, not v1 — it's UI state, not portfolio data. */
export function loadPortfolioColumnPrefs(): PortfolioColumnPrefs {
  const fallback = defaultPrefs()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PortfolioColumnPrefs>
    const known = new Set<PortfolioColumnKey>(DEFAULT_COLUMN_ORDER)

    const order = (parsed.order ?? fallback.order).filter((k) => known.has(k))
    for (const k of DEFAULT_COLUMN_ORDER) {
      if (!order.includes(k)) order.push(k) // columns added since prefs were saved
    }

    const visible = (parsed.visible ?? fallback.visible).filter((k) => known.has(k))

    return { visible, order }
  } catch {
    return fallback
  }
}

export function savePortfolioColumnPrefs(prefs: PortfolioColumnPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}
