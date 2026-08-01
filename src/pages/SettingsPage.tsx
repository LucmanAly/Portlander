import { usePortfolio } from '@/context/PortfolioContext'
import { formatRelativeSync } from '@/lib/format'
import { useState, type FormEvent } from 'react'
import clsx from 'clsx'

export function SettingsPage() {
  const {
    resetDemo,
    lastSyncAt,
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

      {remoteError ? (
        <div className="rounded-xl border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
          {remoteError}
        </div>
      ) : null}

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
            <dt className="text-ink-500">Last sync</dt>
            <dd className="font-medium text-ink-100">{formatRelativeSync(lastSyncAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Holdings / events</dt>
            <dd className="tabular font-medium text-ink-100">
              {holdings.length} · {events.length}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void refreshFromBackend()}
            className="focus-ring rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-border hover:bg-ink-750"
          >
            Reload data
          </button>
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
          {brokerageError ? <p className="text-sm text-critical">{brokerageError}</p> : null}
        </section>
      ) : null}

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
  65% × position_weight (norm to 20%)
+ 25% × event_type_weight
+ 10% × recency_boost`}
        </pre>
      </section>
    </div>
  )
}
