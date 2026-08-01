import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, CloudOff, LayoutDashboard, Briefcase, Settings } from 'lucide-react'
import { usePortfolio } from '@/context/PortfolioContext'
import { formatMoney, formatRelativeSync } from '@/lib/format'
import { RefreshQuotesButton } from '@/components/layout/RefreshQuotesButton'

const nav = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const { exposure, lastSyncAt, holdings, backend, booting, remoteError } = usePortfolio()

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border p-4 lg:flex">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/15 ring-1 ring-accent-500/40">
              <span className="text-sm font-bold text-accent-400">P</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-ink-100">Portlander</div>
              <div
                className={clsx(
                  'text-[11px]',
                  !booting && backend === 'local' ? 'text-amber-300' : 'text-ink-500',
                )}
              >
                {booting ? 'Loading…' : backend === 'supabase' ? 'Cloud sync' : 'Local / demo'}
              </div>
            </div>
          </div>
        </div>
        {remoteError ? (
          <div className="mb-3 rounded-lg border border-critical/25 bg-critical-soft px-2 py-1.5 text-[10px] leading-snug text-critical">
            Sync issue — check Settings
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/30'
                    : 'text-ink-400 hover:bg-ink-800/80 hover:text-ink-100',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <RefreshQuotesButton variant="sidebar" />
          <div className="surface rounded-xl p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Book value
            </div>
            {booting ? (
              <div className="mt-2 space-y-2" aria-label="Loading portfolio summary">
                <div className="h-5 w-28 animate-pulse rounded bg-ink-700" />
                <div className="h-3 w-36 animate-pulse rounded bg-ink-800" />
              </div>
            ) : (
              <>
                <div className="tabular mt-1 text-lg font-semibold text-ink-100">
                  {formatMoney(exposure.totalPortfolioValue)}
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  {holdings.length} holdings · {formatRelativeSync(lastSyncAt)}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="surface sticky top-0 z-20 flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500/15 text-xs font-bold text-accent-400">
              P
            </div>
            <span className="text-sm font-semibold">Portlander</span>
            {!booting && backend === 'local' ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                Local
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {booting ? (
              <span
                className="h-3 w-16 animate-pulse rounded bg-ink-700"
                aria-label="Loading portfolio value"
              />
            ) : (
              <span className="tabular text-xs text-ink-400">
                {formatMoney(exposure.totalPortfolioValue)}
              </span>
            )}
            <RefreshQuotesButton variant="compact" />
          </div>
        </header>

        <main className="scrollbar-thin flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {!booting && backend === 'local' ? (
            <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Local / demo portfolio
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-100/75">
                    These numbers are stored on this device and may be sample data. Sign in to load
                    your cloud-synced holdings.
                  </p>
                </div>
              </div>
              <NavLink
                to="/settings"
                className="focus-ring shrink-0 self-start rounded-lg border border-amber-400/25 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/10 sm:self-auto"
              >
                Open Settings
              </NavLink>
            </div>
          ) : null}

          <div className="mx-auto max-w-6xl">
            {booting ? <AppSkeleton /> : <Outlet />}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="surface sticky bottom-0 z-20 grid grid-cols-4 border-t border-border lg:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
                  isActive ? 'text-accent-400' : 'text-ink-500',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}


function AppSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading portfolio">
      <span className="sr-only">Loading portfolio…</span>
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-accent-500/15" />
          <div className="h-9 w-64 max-w-full rounded-lg bg-ink-700" />
          <div className="h-4 w-full max-w-xl rounded bg-ink-800" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="surface rounded-2xl p-4">
              <div className="h-3 w-20 rounded bg-ink-800" />
              <div className="mt-3 h-7 w-24 rounded bg-ink-700" />
              <div className="mt-3 h-3 w-32 rounded bg-ink-800" />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-8 w-20 rounded-full bg-ink-800" />
          ))}
        </div>

        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="h-4 w-24 rounded bg-ink-700" />
                  <div className="h-5 w-full max-w-md rounded bg-ink-800" />
                  <div className="h-3 w-40 rounded bg-ink-800" />
                </div>
                <div className="h-10 w-16 shrink-0 rounded-lg bg-ink-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
