import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

export function PillButton({
  active,
  onClick,
  children,
  size = 'md',
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'focus-ring rounded-lg font-medium transition',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        active
          ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/40'
          : 'bg-ink-850 text-ink-400 ring-1 ring-border hover:text-ink-200',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconEl = Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null

  return (
    <button
      type="button"
      className={clsx(
        'focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        variant === 'primary' &&
          'bg-accent-500 text-ink-950 font-semibold hover:bg-accent-400',
        variant === 'secondary' &&
          'bg-ink-800 text-ink-200 ring-1 ring-border hover:bg-ink-750',
        variant === 'ghost' && 'bg-transparent text-ink-400 hover:bg-ink-800/80 hover:text-ink-100',
        className,
      )}
      {...rest}
    >
      {iconPosition === 'left' ? iconEl : null}
      {children}
      {iconPosition === 'right' ? iconEl : null}
    </button>
  )
}
