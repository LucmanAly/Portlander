import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Holding, PortfolioEvent, WatchlistItem } from '@/types'
import type { EventFilter } from '@/types'
import { computeExposure, scoreAndFilterEvents } from '@/lib/scoring'
import {
  applyQuoteResultsLocally,
  loadPortfolioBundle,
  markLocalSynced,
  persistHoldingsRemote,
  persistWatchlistRemote,
  refreshQuotesRemote,
  resetLocalDemo,
} from '@/lib/portfolioRepository'
import { applyLocalEventsSync } from '@/lib/eventSync'
import { loadQuotesLastSync } from '@/lib/storage'
import {
  getSupabase,
  isSupabaseConfigured,
  resolveBackend,
  supabaseConfigSummary,
  type DataBackend,
} from '@/lib/supabase'
import { addDays, startOfDay } from 'date-fns'
import type { Session, User } from '@supabase/supabase-js'

interface PortfolioContextValue {
  holdings: Holding[]
  watchlist: WatchlistItem[]
  events: PortfolioEvent[]
  lastSyncAt: string | null
  filter: EventFilter
  setFilter: (f: EventFilter) => void
  upcoming14: ReturnType<typeof scoreAndFilterEvents>
  exposure: ReturnType<typeof computeExposure>
  addHolding: (h: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateHolding: (id: string, patch: Partial<Holding>) => void
  removeHolding: (id: string) => void
  replaceHoldings: (holdings: Holding[]) => void
  addWatchlist: (ticker: string, name?: string) => void
  removeWatchlist: (id: string) => void
  resetDemo: () => void
  markSynced: () => void
  /** Hydration / remote load */
  booting: boolean
  /** local | supabase (effective write target) */
  backend: DataBackend
  supabaseConfigured: boolean
  supabaseHost: string | null
  user: User | null
  session: Session | null
  remoteError: string | null
  refreshFromBackend: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Manual, on-demand live price refresh — never runs automatically, never touches events. */
  quotesSyncing: boolean
  quotesLastSyncedAt: string | null
  quotesError: string | null
  refreshQuotes: () => Promise<void>
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

function uid() {
  return crypto.randomUUID()
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [events, setEvents] = useState<PortfolioEvent[]>([])
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [backend, setBackend] = useState<DataBackend>('local')
  const [quotesSyncing, setQuotesSyncing] = useState(false)
  const [quotesLastSyncedAt, setQuotesLastSyncedAt] = useState<string | null>(() =>
    loadQuotesLastSync(),
  )
  const [quotesError, setQuotesError] = useState<string | null>(null)

  const config = useMemo(() => supabaseConfigSummary(), [])

  const applyBundle = useCallback(
    (bundle: Awaited<ReturnType<typeof loadPortfolioBundle>>) => {
      setHoldings(bundle.holdings)
      setWatchlist(bundle.watchlist)
      setEvents(bundle.events)
      setLastSyncAt(bundle.lastSyncAt)
      setBackend(bundle.backend)
    },
    [],
  )

  const refreshFromBackend = useCallback(async () => {
    try {
      setRemoteError(null)
      // Always try local Finnhub file first (npm run sync:events) — no cloud required
      await applyLocalEventsSync()

      const sb = getSupabase()
      let uid: string | null = null
      if (sb) {
        const { data } = await sb.auth.getSession()
        uid = data.session?.user?.id ?? null
        setSession(data.session)
        setUser(data.session?.user ?? null)
      } else {
        setSession(null)
        setUser(null)
      }
      const bundle = await loadPortfolioBundle(uid)
      applyBundle(bundle)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load portfolio'
      setRemoteError(msg)
      // Fallback to local so UI never dies
      const bundle = await loadPortfolioBundle(null)
      applyBundle(bundle)
    }
  }, [applyBundle])

  // Manual, on-demand live price refresh — never runs automatically, never
  // touches events/watchlist. Deliberately doesn't call refreshFromBackend()
  // afterward: that also re-merges the local Finnhub file and reloads
  // events/watchlist, which would blur the "price-only" boundary this is
  // scoped to. The Edge Function's response already carries the new prices.
  const refreshQuotes = useCallback(async () => {
    if (quotesSyncing) return
    if (backend !== 'supabase') {
      setQuotesError('Sign in to refresh live prices')
      return
    }
    setQuotesSyncing(true)
    setQuotesError(null)
    try {
      const { error, outcome } = await refreshQuotesRemote()
      if (error || !outcome) {
        setQuotesError(error?.message ?? 'Refresh failed')
        return
      }
      setHoldings((prev) => applyQuoteResultsLocally(prev, outcome.results))
      setQuotesLastSyncedAt(outcome.finishedAt ?? new Date().toISOString())
      if (outcome.errors.length > 0) {
        setQuotesError(`${outcome.results.length}/${outcome.tickersAttempted} prices updated`)
      }
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setQuotesSyncing(false)
    }
  }, [quotesSyncing, backend])

  // Boot: local immediately, then Supabase session + remote if configured
  useEffect(() => {
    let cancelled = false

    async function boot() {
      setBooting(true)
      try {
        // Always paint local first for speed
        const local = await loadPortfolioBundle(null)
        if (!cancelled) applyBundle(local)

        // Merge Finnhub file from `npm run sync:events` (cloud mode not required)
        await applyLocalEventsSync()
        if (!cancelled) {
          const afterSync = await loadPortfolioBundle(null)
          applyBundle(afterSync)
        }

        const sb = getSupabase()
        if (!sb) {
          if (!cancelled) setBooting(false)
          return
        }

        const { data } = await sb.auth.getSession()
        if (cancelled) return
        setSession(data.session)
        setUser(data.session?.user ?? null)

        if (data.session?.user) {
          const remote = await loadPortfolioBundle(data.session.user.id)
          if (!cancelled) applyBundle(remote)
        } else {
          if (!cancelled) setBackend(resolveBackend(false))
        }

        const {
          data: { subscription },
        } = sb.auth.onAuthStateChange(async (_event, nextSession) => {
          setSession(nextSession)
          setUser(nextSession?.user ?? null)
          try {
            const bundle = await loadPortfolioBundle(nextSession?.user?.id ?? null)
            applyBundle(bundle)
            setRemoteError(null)
          } catch (e) {
            setRemoteError(e instanceof Error ? e.message : 'Auth refresh load failed')
          }
        })

        if (!cancelled) setBooting(false)

        return () => subscription.unsubscribe()
      } catch (e) {
        if (!cancelled) {
          setRemoteError(e instanceof Error ? e.message : 'Boot failed')
          setBooting(false)
        }
      }
    }

    let unsub: (() => void) | undefined
    boot().then((cleanup) => {
      if (typeof cleanup === 'function') unsub = cleanup
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [applyBundle])

  const persistHoldings = useCallback(
    (next: Holding[]) => {
      setHoldings(next)
      void persistHoldingsRemote(next, user?.id ?? null).then((err) => {
        if (err) setRemoteError(err.message)
      })
    },
    [user?.id],
  )

  const persistWatchlist = useCallback(
    (next: WatchlistItem[]) => {
      setWatchlist(next)
      void persistWatchlistRemote(next, user?.id ?? null).then((err) => {
        if (err) setRemoteError(err.message)
      })
    },
    [user?.id],
  )

  const upcoming14 = useMemo(() => {
    const today = startOfDay(new Date())
    return scoreAndFilterEvents(events, holdings, watchlist, {
      filter,
      fromDate: today,
      toDate: addDays(today, 14),
      today,
    })
  }, [events, holdings, watchlist, filter])

  const exposure = useMemo(() => {
    const today = startOfDay(new Date())
    return computeExposure(events, holdings, watchlist, today)
  }, [events, holdings, watchlist])

  const addHolding = useCallback(
    (input: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const ticker = input.ticker.toUpperCase()
      const existing = holdings.find((h) => h.ticker.toUpperCase() === ticker)
      if (existing) {
        persistHoldings(
          holdings.map((h) =>
            h.id === existing.id
              ? {
                  ...h,
                  ...input,
                  ticker,
                  shares: input.shares,
                  updatedAt: now,
                }
              : h,
          ),
        )
        return
      }
      persistHoldings([
        ...holdings,
        { ...input, ticker, id: uid(), createdAt: now, updatedAt: now },
      ])
    },
    [holdings, persistHoldings],
  )

  const updateHolding = useCallback(
    (id: string, patch: Partial<Holding>) => {
      persistHoldings(
        holdings.map((h) =>
          h.id === id
            ? {
                ...h,
                ...patch,
                ticker: patch.ticker ? patch.ticker.toUpperCase() : h.ticker,
                updatedAt: new Date().toISOString(),
              }
            : h,
        ),
      )
    },
    [holdings, persistHoldings],
  )

  const removeHolding = useCallback(
    (id: string) => {
      persistHoldings(holdings.filter((h) => h.id !== id))
    },
    [holdings, persistHoldings],
  )

  const replaceHoldings = useCallback(
    (next: Holding[]) => {
      persistHoldings(next)
    },
    [persistHoldings],
  )

  const addWatchlist = useCallback(
    (ticker: string, name?: string) => {
      const t = ticker.toUpperCase()
      if (watchlist.some((w) => w.ticker === t)) return
      persistWatchlist([
        ...watchlist,
        {
          id: uid(),
          ticker: t,
          name,
          createdAt: new Date().toISOString(),
        },
      ])
    },
    [watchlist, persistWatchlist],
  )

  const removeWatchlist = useCallback(
    (id: string) => {
      persistWatchlist(watchlist.filter((w) => w.id !== id))
    },
    [watchlist, persistWatchlist],
  )

  const resetDemo = useCallback(() => {
    resetLocalDemo()
    void loadPortfolioBundle(null).then(applyBundle)
    setBackend('local')
  }, [applyBundle])

  const markSynced = useCallback(() => {
    const iso = markLocalSynced()
    setLastSyncAt(iso)
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase is not configured' }
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
    const local = await loadPortfolioBundle(null)
    applyBundle(local)
  }, [applyBundle])

  const value: PortfolioContextValue = {
    holdings,
    watchlist,
    events,
    lastSyncAt,
    filter,
    setFilter,
    upcoming14,
    exposure,
    addHolding,
    updateHolding,
    removeHolding,
    replaceHoldings,
    addWatchlist,
    removeWatchlist,
    resetDemo,
    markSynced,
    booting,
    backend,
    supabaseConfigured: isSupabaseConfigured(),
    supabaseHost: config.urlHost,
    user,
    session,
    remoteError,
    refreshFromBackend,
    signInWithMagicLink,
    signOut,
    quotesSyncing,
    quotesLastSyncedAt,
    quotesError,
    refreshQuotes,
  }

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider')
  return ctx
}
