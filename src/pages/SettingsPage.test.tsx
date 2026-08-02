import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { SettingsPage } from '@/pages/SettingsPage'
import { renderWithPortfolio } from '@/test/testProviders'

const NAV_LABELS = ['Account', 'Brokerage', 'Data & sync', 'Earnings intelligence', 'Diagnostics', 'About']

describe('SettingsPage information architecture', () => {
  it('renders a local nav with all 6 sections, each resolving to a real section id', () => {
    renderWithPortfolio(<SettingsPage />)
    const nav = screen.getByRole('navigation', { name: 'Settings sections' })
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(6)

    for (const link of Array.from(links)) {
      expect(NAV_LABELS).toContain(link.textContent)
      const targetId = link.getAttribute('href')?.slice(1)
      expect(document.getElementById(targetId ?? '')).not.toBeNull()
    }
  })

  it('renders all 6 sections in the requested order', () => {
    renderWithPortfolio(<SettingsPage />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'Account',
      'Brokerage',
      'Data & sync',
      'Earnings intelligence',
      'Diagnostics',
      'About this build',
    ])
  })

  it('Account section explains sign-in is unavailable when Supabase is not configured, rather than hiding the section', () => {
    renderWithPortfolio(<SettingsPage />, { overrides: { supabaseConfigured: false } })
    expect(document.getElementById('account')).not.toBeNull()
    expect(screen.getByText(/sign-in is unavailable until supabase is configured/i)).toBeInTheDocument()
  })

  it('Brokerage section points to Account instead of hiding when not signed in', () => {
    renderWithPortfolio(<SettingsPage />, { overrides: { supabaseConfigured: true, user: null } })
    expect(document.getElementById('brokerage')).not.toBeNull()
    expect(screen.getByText(/sign in under/i)).toBeInTheDocument()
  })

  it('Earnings intelligence section discloses fixture-sourced data honestly', () => {
    renderWithPortfolio(<SettingsPage />)
    expect(screen.getByText('Interim fixture data')).toBeInTheDocument()
    expect(screen.getByText(/no live provider populates consensus/i)).toBeInTheDocument()
    expect(screen.getByText(/never blended into the/i)).toBeInTheDocument()
  })

  it('Diagnostics keeps all 5 health checks and the retry actions', () => {
    renderWithPortfolio(<SettingsPage />)
    // "Positions"/"Prices"/"Events" also label Data & sync's timestamp dl, so scope to Diagnostics.
    const diagnostics = document.getElementById('diagnostics')
    expect(diagnostics).not.toBeNull()
    for (const label of ['Backend', 'Authentication', 'Positions', 'Prices', 'Events']) {
      expect(diagnostics).toHaveTextContent(label)
    }
    expect(screen.getByRole('button', { name: /reload data/i })).toBeInTheDocument()
  })

  it('shows actionable raw error detail in Diagnostics when errors are present', () => {
    renderWithPortfolio(<SettingsPage />, { overrides: { remoteError: 'fetch failed: 503 from /rest/v1/holdings' } })
    expect(screen.getByRole('alert')).toHaveTextContent('fetch failed: 503 from /rest/v1/holdings')
  })

  it('About this build keeps the real release metadata, not a placeholder', () => {
    renderWithPortfolio(<SettingsPage />)
    expect(screen.getByText('v1.0')).toBeInTheDocument()
    expect(screen.queryByText(/v1\.4/)).not.toBeInTheDocument()
  })
})
