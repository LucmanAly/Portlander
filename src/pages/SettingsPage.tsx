import { usePortfolio } from '@/context/PortfolioContext'
import { formatRelativeSync } from '@/lib/format'
import { APP_LAST_UPDATED, APP_PHASE, APP_VERSION, formatAppUpdatedAt } from '@/lib/appMeta'
import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw, Sparkles } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'brokerage', label: 'Brokerage' },
  { id: 'data-sync', label: 'Data & sync' },
  { id: 'earnings-intelligence', label: 'Earnings intelligence' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'about', label: 'About' },
]

export function SettingsPage() {
  const {
    resetDemo,
    syncTimestamps,
    holdings,
    events,
    backend,
    supabaseConfigured,
    supabaseHost,
    user,
    remoteError,
    refreshFromBackend,
    signInWithMagicLink,
    signOut,
    booting,
    brokerageConnections,
    brokerageConnecting,
    brokerageSyncing,
    brokerageError,
    connectBrokerage,
    syncBrokerage,
    quotesLastSyncedAt,
    quotesError,
    quotesSyncing,
    refreshQuotes,
  } = usePortfolio()

  const [email, setEmail] = useState('')
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  async function onMagicLink(e: FormEvent) {
    e.preventDefault()
    setAuthMsg(null)
    setAuthBusy(true)
    const { error } = await signInWithMagicLink(email)
    setAuthBusy(false)
    if (error) setAuthMsg(error)
    else setAuthMsg('Check your email for the magic link.')
  }

  const modeLabel = !supabaseConfigured
    ? 'Local / demo'
    : user
      ? 'Supabase (signed in)'
      : 'Supabase configured · using local until sign-in'

  const backendState: DiagnosticState = remoteError
    ? 'error'
    : booting
      ? 'checking'
      : backend === 'supabase'
        ? 'healthy'
        : 'local'
  const authState: DiagnosticState = !supabaseConfigured
    ? 'local'
    : user
      ? 'healthy'
      : 'attention'
  const positionsState: DiagnosticState = brokerageError
    ? 'error'
    : brokerageConnections.length > 0
      ? 'healthy'
      : 'not-run'
  const pricesState: DiagnosticState = quotesError
    ? 'error'
    : quotesLastSyncedAt || syncTimestamps.prices
      ? 'healthy'
      : 'not-run'
  const eventsState: DiagnosticState = remoteError
    ? 'error'
    : syncTimestamps.events
      ? 'healthy'
      : 'not-run'
  const hasIssues = Boolean(remoteError || brokerageError || quotesError)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-500">
          Settings
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-100">Workspace</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Local mode always works. Add{' '}
          <code className="text-ink-300">VITE_SUPABASE_URL</code> +{' '}
          <code className="text-ink-300">VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code className="text-ink-300">.env.local</code>, apply{' '}
          <code className="text-ink-300">supabase/schema.sql</code>, then sign in to sync.
        </p>
      </header>

      <nav
        aria-label="Settings sections"
        className="surface sticky top-0 z-10 flex gap-1.5 overflow-x-auto rounded-xl p-1.5"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="focus-ring shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <SettingsSection id="account" title="Account">
        {!supabaseConfigured ? (
          <p className="text-sm text-ink-450">
            Local / demo mode — sign-in is unavailable until Supabase is configured. See{' '}
            <a href="#data-sync" className="text-accent-400 hover:text-accent-300">
              Data &amp; sync
            </a>{' '}
            for setup steps.
          </p>
        ) : user ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-300">
              Signed in as <span className="text-ink-100">{user.email}</span>
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="focus-ring rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={onMagicLink} className="space-y-3">
            <p className="text-sm text-ink-400">
              Magic-link sign-in. After auth, holdings/watchlist write to Supabase; events load
              from the DB (global macro + your rows).
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-450">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </label>
            <button
              type="submit"
              disabled={authBusy}
              className="focus-ring rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-400 disabled:opacity-50"
            >
              {authBusy ? 'Sending…' : 'Send magic link'}
            </button>
            {authMsg ? (
              <p className={clsx('text-sm', authMsg.includes('Check') ? 'text-accent-400' : 'text-critical')}>
                {authMsg}
              </p>
            ) : null}
          </form>
        )}
      </SettingsSection>

      <SettingsSection
        id="brokerage"
        title="Brokerage"
        description="Connect a brokerage via SnapTrade to sync real positions into Portfolio. CSV/manual entries stay available for any ticker your brokerage doesn't cover."
      >
        {!supabaseConfigured || !user ? (
          <p className="text-sm text-ink-450">
            Sign in under{' '}
            <a href="#account" className="text-accent-400 hover:text-accent-300">
              Account
            </a>{' '}
            first to connect a brokerage.
          </p>
        ) : (
          <>
            {brokerageConnections.length > 0 ? (
              <ul className="space-y-1.5">
                {brokerageConnections.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-ink-850 px-3 py-2 text-sm ring-1 ring-border"
                  >
                    <span className="font-medium text-ink-100">{c.brokerageName}</span>
                    <span className="text-xs text-ink-450">
                      Connected {formatRelativeSync(c.connectedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-450">No brokerage connected yet.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void connectBrokerage()}
                disabled={brokerageConnecting}
                className="focus-ring rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750 disabled:opacity-50"
              >
                {brokerageConnecting
                  ? 'Opening…'
                  : brokerageConnections.length > 0
                    ? 'Connect another brokerage'
                    : 'Connect brokerage'}
              </button>
              <button
                type="button"
                onClick={() => void syncBrokerage()}
                disabled={brokerageSyncing}
                className="focus-ring rounded-xl bg-accent-500 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-400 disabled:opacity-50"
              >
                {brokerageSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection id="data-sync" title="Data & sync">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-450">Mode</dt>
            <dd className="font-medium text-ink-100">{modeLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-450">Write backend</dt>
            <dd className="font-medium text-ink-100">
              <span
                className={clsx(
                  'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1',
                  backend === 'supabase'
                    ? 'bg-accent-glow text-accent-400 ring-accent-500/40'
                    : 'bg-ink-800 text-ink-300 ring-border',
                )}
              >
                {backend}
              </span>
              {booting ? <span className="ml-2 text-xs text-ink-450">booting…</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-450">Supabase</dt>
            <dd className="font-medium text-ink-100">
              {supabaseConfigured ? (
                <span className="text-accent-400">{supabaseHost}</span>
              ) : (
                <span className="text-ink-450">Not configured</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-450">Account</dt>
            <dd className="truncate font-medium text-ink-100">
              {user?.email ?? (supabaseConfigured ? 'Signed out' : '—')}
            </dd>
          </div>
          <div>
            <dt className="text-ink-450">Holdings / events</dt>
            <dd className="tabular font-medium text-ink-100">
              {holdings.length} · {events.length}
            </dd>
          </div>
        </dl>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-450">Positions</dt>
            <dd className="font-medium text-ink-100">
              {formatRelativeSync(syncTimestamps.positions)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-450">Prices</dt>
            <dd className="font-medium text-ink-100">
              {formatRelativeSync(syncTimestamps.prices)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-450">Events</dt>
            <dd className="font-medium text-ink-100">
              {formatRelativeSync(syncTimestamps.events)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={Boolean(user)}
            title={
              user
                ? 'Sign out first — demo data would overwrite your synced portfolio'
                : undefined
            }
            onClick={() => {
              if (
                confirm(
                  'Reset to demo portfolio and events? This replaces local holdings. Remote Supabase rows are not deleted.',
                )
              ) {
                resetDemo()
              }
            }}
            className="focus-ring rounded-xl bg-critical-soft px-3 py-2 text-sm font-medium text-critical ring-1 ring-critical/30 hover:bg-critical/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset demo data
          </button>
        </div>

        <details className="rounded-xl bg-ink-950/30 px-3 py-2.5">
          <summary className="cursor-pointer text-sm font-medium text-ink-300">
            Cloud setup checklist
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-400">
            <li>
              Create a Supabase project; run <code className="text-ink-300">supabase/schema.sql</code>
            </li>
            <li>
              Copy URL + anon key into <code className="text-ink-300">.env.local</code>
            </li>
            <li>Enable Email auth (magic link) in Supabase Auth settings</li>
            <li>Restart <code className="text-ink-300">npm run dev</code> after env changes</li>
            <li>Sign in here — write backend becomes <code className="text-ink-300">supabase</code></li>
          </ol>
        </details>
      </SettingsSection>

      <SettingsSection
        id="earnings-intelligence"
        title="Earnings intelligence"
        description="What powers the consensus/actual/guidance data on Today and Earnings, and how generated content is handled."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-450">Verified facts</dt>
            <dd className="font-medium text-ink-100">Finnhub (once wired) — never an LLM</dd>
          </div>
          <div>
            <dt className="text-ink-450">Current status</dt>
            <dd className="font-medium text-amber-300">Interim fixture data</dd>
          </div>
        </dl>
        <p className="text-sm leading-relaxed text-ink-400">
          No live provider populates consensus, actual results, surprise, guidance, or reaction
          yet — Finnhub's earnings-calendar response has EPS estimate/actual, but wiring it into
          this app's data model is future backend work. Until then, cards show a small typed
          fixture set for a handful of tickers; any other ticker honestly renders "no estimate
          available" rather than a fabricated number.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-accent-500/30 bg-accent-glow/40 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-300">
            When a generated interpretation is present, it's always shown in a separately
            labeled "Generated interpretation — not verified" section, never blended into the
            verified financials above it.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        id="diagnostics"
        title="Diagnostics"
        description="Live checks for authentication, backend data, prices, events and brokerage sync."
        badge={
          <span className="rounded-full bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-450 ring-1 ring-border">
            Live
          </span>
        }
      >
        <div className="divide-y divide-border rounded-xl bg-ink-950/30 px-3">
          <DiagnosticRow
            label="Backend"
            state={backendState}
            detail={
              backend === 'supabase'
                ? 'Supabase data path is active.'
                : 'Local / demo data path is active.'
            }
          />
          <DiagnosticRow
            label="Authentication"
            state={authState}
            detail={
              user?.email
                ? 'Signed in as ' + user.email
                : supabaseConfigured
                  ? 'Supabase is configured, but no session is active.'
                  : 'Supabase is not configured.'
            }
          />
          <DiagnosticRow
            label="Positions"
            state={positionsState}
            detail={
              brokerageConnections.length > 0
                ? brokerageConnections.length +
                  ' brokerage connection(s) · ' +
                  formatRelativeSync(syncTimestamps.positions)
                : 'No brokerage connection has been tested in this session.'
            }
          />
          <DiagnosticRow
            label="Prices"
            state={pricesState}
            detail={
              quotesLastSyncedAt || syncTimestamps.prices
                ? 'Last refreshed ' +
                  formatRelativeSync(quotesLastSyncedAt || syncTimestamps.prices)
                : 'No live price refresh has been run.'
            }
          />
          <DiagnosticRow
            label="Events"
            state={eventsState}
            detail={
              syncTimestamps.events
                ? 'Last synced ' + formatRelativeSync(syncTimestamps.events)
                : 'No remote event sync is recorded.'
            }
          />
        </div>

        {hasIssues ? (
          <div
            className="rounded-xl border border-critical/30 bg-critical-soft px-3 py-2.5 text-sm text-critical"
            role="alert"
          >
            <p className="font-semibold">Issues reported</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {remoteError ? <li>Data/backend: {remoteError}</li> : null}
              {quotesError ? <li>Prices: {quotesError}</li> : null}
              {brokerageError ? <li>Brokerage: {brokerageError}</li> : null}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-ink-450">
            No current errors have been reported. The actions below re-run the relevant checks.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void refreshFromBackend()}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload data
          </button>
          {supabaseConfigured && user ? (
            <button
              type="button"
              onClick={() => void refreshQuotes()}
              disabled={quotesSyncing}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750 disabled:opacity-50"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', quotesSyncing && 'animate-spin')} />
              {quotesSyncing ? 'Checking prices…' : 'Check prices'}
            </button>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        id="about"
        title="About this build"
        description="Release metadata for the version currently running."
        badge={
          <span className="tabular rounded-lg bg-accent-glow px-2.5 py-1 text-sm font-semibold text-accent-300 ring-1 ring-accent-500/30">
            v{APP_VERSION}
          </span>
        }
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-450">Phase</dt>
            <dd className="font-medium text-ink-100">{APP_PHASE}</dd>
          </div>
          <div>
            <dt className="text-ink-450">Last updated</dt>
            <dd className="font-medium text-ink-100">
              {formatAppUpdatedAt(APP_LAST_UPDATED)}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-ink-450">
          The timestamp is updated with the release metadata when a version is promoted to
          <code className="mx-1 text-ink-300">main</code>.
        </p>

        <div className="rounded-xl bg-ink-950/30 p-3">
          <h3 className="mb-2 text-xs font-medium text-ink-450">Impact score v0</h3>
          <pre
            tabIndex={0}
            aria-label="Impact score formula, horizontally scrollable"
            className="focus-ring overflow-x-auto rounded-xl bg-ink-950/60 p-3 font-mono text-xs text-ink-300"
          >
{`impact =
  65% × position_weight (norm to anchor)
+ 25% × event_type_weight
+ 10% × recency_boost

anchor = max(5%, p90 position weight × 1.5)`}
          </pre>
        </div>
      </SettingsSection>
    </div>
  )
}

function SettingsSection({
  id,
  title,
  description,
  badge,
  children,
}: {
  id: string
  title: string
  description?: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="surface-elevated scroll-mt-16 space-y-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-450">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-400">{description}</p> : null}
        </div>
        {badge}
      </div>
      {children}
    </section>
  )
}

type DiagnosticState = 'healthy' | 'attention' | 'error' | 'checking' | 'local' | 'not-run'

const diagnosticStateStyles: Record<
  DiagnosticState,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  healthy: {
    label: 'Healthy',
    className: 'text-accent-400 ring-accent-500/30 bg-accent-glow',
    icon: CheckCircle2,
  },
  attention: {
    label: 'Action needed',
    className: 'text-amber-300 ring-amber-400/30 bg-amber-400/10',
    icon: CircleHelp,
  },
  error: {
    label: 'Error',
    className: 'text-critical ring-critical/30 bg-critical-soft',
    icon: AlertCircle,
  },
  checking: {
    label: 'Checking',
    className: 'text-ink-300 ring-border bg-ink-800',
    icon: RefreshCw,
  },
  local: {
    label: 'Local',
    className: 'text-amber-300 ring-amber-400/30 bg-amber-400/10',
    icon: CircleHelp,
  },
  'not-run': {
    label: 'Not tested',
    className: 'text-ink-400 ring-border bg-ink-800',
    icon: CircleHelp,
  },
}

function DiagnosticRow({
  label,
  state,
  detail,
}: {
  label: string
  state: DiagnosticState
  detail: string
}) {
  const status = diagnosticStateStyles[state]
  const Icon = status.icon

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-200">{label}</p>
        <p className="mt-0.5 truncate text-xs text-ink-450">{detail}</p>
      </div>
      <span
        className={clsx(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ring-1',
          status.className,
        )}
      >
        <Icon className={clsx('h-3 w-3', state === 'checking' && 'animate-spin')} />
        {status.label}
      </span>
    </div>
  )
}
