import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { renderWithPortfolio } from '@/test/testProviders'

const NAV_ORDER = ['Today', 'Earnings', 'Calendar', 'Portfolio', 'Settings']
const MOBILE_BOTTOM_NAV_ORDER = ['Today', 'Earnings', 'Calendar', 'Portfolio']

function renderShell(overrides?: Parameters<typeof renderWithPortfolio>[1]) {
  return renderWithPortfolio(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<div>Today content</div>} />
      </Route>
    </Routes>,
    overrides,
  )
}

describe('AppShell navigation', () => {
  it('renders all 5 routes in order on the desktop sidebar', () => {
    renderShell()
    const sidebarNav = screen.getAllByRole('navigation')[0]
    const links = within(sidebarNav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(NAV_ORDER)
  })

  it('renders 4 primary routes in order on the mobile bottom nav, Settings excluded', () => {
    renderShell()
    const navs = screen.getAllByRole('navigation')
    const mobileNav = navs[navs.length - 1]
    const links = within(mobileNav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(MOBILE_BOTTOM_NAV_ORDER)
  })

  it('still reaches Settings on mobile via the top-bar icon', () => {
    renderShell()
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('never renders a Book value card', () => {
    renderShell()
    expect(screen.queryByText(/book value/i)).not.toBeInTheDocument()
  })

  it('still renders the Refresh prices sidebar control', () => {
    renderShell()
    expect(screen.getByText(/refresh prices/i)).toBeInTheDocument()
  })

  it('shows the compact Local/Demo pill by default, full banner only on request', async () => {
    const user = userEvent.setup()
    renderShell({ overrides: { backend: 'local', booting: false } })
    expect(screen.getByText('Local')).toBeInTheDocument()
    expect(screen.queryByText(/local \/ demo portfolio/i)).not.toBeInTheDocument()

    await user.click(screen.getByText('Local'))
    expect(screen.getByText(/local \/ demo portfolio/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/local \/ demo portfolio/i)).not.toBeInTheDocument()
  })

  it('does not show the Local/Demo banner when backend is supabase', () => {
    renderShell({ overrides: { backend: 'supabase', booting: false } })
    expect(screen.queryByText(/local \/ demo portfolio/i)).not.toBeInTheDocument()
  })

  it('shows the boot skeleton instead of routed content while booting', () => {
    renderShell({ overrides: { booting: true } })
    expect(screen.getByRole('status', { name: /loading portfolio/i })).toBeInTheDocument()
    expect(screen.queryByText('Today content')).not.toBeInTheDocument()
  })
})
