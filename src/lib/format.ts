import { format, parseISO, isToday, isTomorrow } from 'date-fns'

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n)
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`
}

export function formatEventDay(isoDate: string): string {
  const d = parseISO(isoDate)
  if (isToday(d)) return `Today · ${format(d, 'EEE, MMM d')}`
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'EEE, MMM d')}`
  return format(d, 'EEEE, MMMM d')
}

export function formatFullDate(isoDate: string): string {
  return format(parseISO(isoDate), 'EEE, MMM d yyyy')
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'Never synced'
  const d = new Date(iso)
  return `Synced ${format(d, 'MMM d · HH:mm')}`
}

/** Compact ticking caption for the manual price-refresh button. */
export function formatRelativeShort(iso: string | null): string {
  if (!iso) return 'Not refreshed yet'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  return `Updated ${format(new Date(iso), 'MMM d')}`
}

/** Signed percent for surprise/reaction values. No leading '+' on exactly 0.0%. `undefined` → em dash. */
export function formatSignedPct(n: number | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  const fixed = n.toFixed(digits)
  return n > 0 ? `+${fixed}%` : `${fixed}%`
}

/** Compact dollar figure (e.g. "$1.2M") for revenue-scale numbers. `undefined` → em dash. */
export function formatCompactMoney(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(n)
}

/** EPS dollar figure, always 2 decimals, sign before the dollar sign (e.g. "-$0.42"). `undefined` → em dash. */
export function formatEps(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}
