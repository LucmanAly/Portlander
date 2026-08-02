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

/** Signed percent, e.g. "+4.2%" / "-1.0%" — for beat/miss deltas. */
export function formatSignedPct(n: number, digits = 1): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

/** Compact currency for large figures (revenue), e.g. "$2.1B". */
export function formatCompactMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
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
