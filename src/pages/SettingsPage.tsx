import { usePortfolio } from '@/context/PortfolioContext'
import { formatRelativeSync } from '@/lib/format'
import { APP_LAST_UPDATED, APP_PHASE, APP_VERSION, formatAppUpdatedAt } from '@/lib/appMeta'
import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

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

      <section className="surface-elevated space-y-4 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
              About this build
            </h2>
            <p className="mt-1 text-sm text-ink-400">
              Release metadata for the version currently running.
            </p>
          </div>
          <span className="tabular rounded-lg bg-accent-glow px-2.5 py-1 text-sm font-semibold text-accent-300 ring-1 ring-accent-500/30">
            v{APP_VERSION}
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Phase</dt>
            <dd className="font-medium text-ink-100">{APP_PHASE}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Last updated</dt>
            <dd className="font-medium text-ink-100">
              {formatAppUpdatedAt(APP_LAST_UPDATED)}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-ink-500">
          The timestamp is updated with the release metadata when a version is promoted to
          <code className="mx-1 text-ink-300">main</code>.
        </p>
      </section>

      <section className="surface-elevated space-y-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Data</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Mode</dt>
            <dd className="font-medium text-ink-100">{modeLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Write backend</dt>
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
              {booting ? <span className="ml-2 text-xs text-ink-500">booting…</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Supabase</dt>
            <dd className="font-medium text-ink-100">
              {supabaseConfigured ? (
                <span className="text-accent-400">{supabaseHost}</span>
              ) : (
                <span className="text-ink-500">Not configured</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Account</dt>
            <dd className="truncate font-medium text-ink-100">
              {user?.email ?? (supabaseConfigured ? 'Signed out' : '—')}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Holdings / events</dt>
            <dd className="tabular font-medium text-ink-100">
              {holdings.length} · {events.length}
            </dd>
          </div>
        </dl>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-500">Positions</dt>
            <dd className="font-medium text-ink-100">
              {formatRelativeSync(syncTimestamps.positions)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Prices</dt>
            <dd className="font-medium text-ink-100">
              {formatRelativeSync(syncTimestamps.prices)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Events</dt>
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
      </section>

      {supabaseConfigured ? (
        <section className="surface-elevated space-y-4 rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Auth</h2>
          {user ? (
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
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
                  Email
                </span>
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
                <p
                  className={clsx(
                    'text-sm',
                    authMsg.includes('Check') ? 'text-accent-400' : 'text-critical',
                  )}
                >
                  {authMsg}
                </p>
              ) : null}
            </form>
          )}
        </section>
      ) : null}

      {supabaseConfigured && user ? (
        <section className="surface-elevated space-y-4 rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Brokerage
          </h2>
          <p className="text-sm text-ink-400">
            Connect a brokerage via SnapTrade to sync real positions into Portfolio. CSV/manual
            entries stay available for any ticker your brokerage doesn't cover.
          </p>

          {brokerageConnections.length > 0 ? (
            <ul className="space-y-1.5">
              {brokerageConnections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-ink-850 px-3 py-2 text-sm ring-1 ring-border"
                >
                  <span className="font-medium text-ink-100">{c.brokerageName}</span>
                  <span className="text-xs text-ink-500">
                    Connected {formatRelativeSync(c.connectedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No brokerage connected yet.</p>
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
        </section>
      ) : null}

      <section className="surface-elevated space-y-4 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
              Diagnostics
            </h2>
            <p className="mt-1 text-sm text-ink-400">
              Live checks for authentication, backend data, prices, events and brokerage sync.
            </p>
          </div>
          <span className="rounded-full bg-ink-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 ring-1 ring-border">
            Live
          </span>
        </div>

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
          <p className="text-xs text-ink-500">
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
      </section>

      <section className="surface-elevated space-y-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
          Setup checklist
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-400">
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
      </section>

      <section className="surface rounded-2xl p-5 text-sm text-ink-400">
        <h2 className="mb-2 text-sm font-semibold text-ink-200">Impact score v0</h2>
        <pre className="overflow-x-auto rounded-xl bg-ink-950/60 p-3 font-mono text-xs text-ink-300">
{`impact =
  65% × position_weight (norm to anchor)
+ 25% × event_type_weight
+ 10% × recency_boost

anchor = max(5%, p90 position weight × 1.5)`}
        </pre>
      </section>
    </div>
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
        <p className="mt-0.5 truncate text-xs text-ink-500">{detail}</p>
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
