import { format, parseISO, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns'

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
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  const days = differenceInCalendarDays(d, new Date())
  if (days > 0 && days < 7) return format(d, 'EEEE')
  return format(d, 'MMM d')
}

export function formatFullDate(isoDate: string): string {
  return format(parseISO(isoDate), 'EEE, MMM d yyyy')
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'Never synced'
  const d = new Date(iso)
  return `Synced ${format(d, 'MMM d · HH:mm')}`
}
