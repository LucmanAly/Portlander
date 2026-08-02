import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PortfolioContext, type PortfolioContextValue } from '@/context/PortfolioContext'

/** Baseline context value: empty/local/booted-false state, every action a no-op. */
export function makePortfolioContextValue(
  overrides?: Partial<PortfolioContextValue>,
): PortfolioContextValue {
  return {
    holdings: [],
    watchlist: [],
    events: [],
    lastSyncAt: null,
    syncTimestamps: { positions: null, prices: null, events: null },
    filter: 'all',
    setFilter: () => {},
    upcoming14: [],
    exposure: {
      earnings7dPct: 0,
      earnings30dPct: 0,
      nextCritical: null,
      totalPortfolioValue: 0,
      holdingsCount: 0,
    },
    addHolding: () => {},
    updateHolding: () => {},
    removeHolding: () => {},
    applyCsvImport: () => {},
    addWatchlist: () => {},
    removeWatchlist: () => {},
    resetDemo: () => {},
    booting: false,
    backend: 'local',
    supabaseConfigured: false,
    supabaseHost: null,
    user: null,
    session: null,
    remoteError: null,
    refreshFromBackend: async () => {},
    signInWithMagicLink: async () => ({ error: null }),
    signOut: async () => {},
    quotesSyncing: false,
    quotesLastSyncedAt: null,
    quotesError: null,
    refreshQuotes: async () => {},
    brokerageConnections: [],
    brokerageConnecting: false,
    brokerageSyncing: false,
    brokerageError: null,
    connectBrokerage: async () => {},
    syncBrokerage: async () => {},
    ...overrides,
  }
}

export function PortfolioTestProvider({
  children,
  overrides,
}: {
  children: ReactNode
  overrides?: Partial<PortfolioContextValue>
}) {
  return (
    <PortfolioContext.Provider value={makePortfolioContextValue(overrides)}>
      {children}
    </PortfolioContext.Provider>
  )
}

/** Renders `ui` inside a MemoryRouter + a fake PortfolioProvider, skipping the real Supabase boot path. */
export function renderWithPortfolio(
  ui: ReactElement,
  options?: {
    overrides?: Partial<PortfolioContextValue>
    initialEntries?: string[]
  },
) {
  return render(
    <MemoryRouter initialEntries={options?.initialEntries ?? ['/']}>
      <PortfolioTestProvider overrides={options?.overrides}>{ui}</PortfolioTestProvider>
    </MemoryRouter>,
  )
}
