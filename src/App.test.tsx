import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PortfolioProvider } from '@/context/PortfolioContext'
import { AppShell } from '@/components/layout/AppShell'
import { TodayPage } from '@/pages/TodayPage'
import { EarningsPage } from '@/pages/EarningsPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { SettingsPage } from '@/pages/SettingsPage'

// No Supabase env configured in tests, so PortfolioProvider boots straight to
// local/demo mode — real boot path, not the fake test provider, since this
// suite is specifically about routing through the real app tree.
function renderAt(path: string) {
  return render(
    <PortfolioProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<div>redirected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PortfolioProvider>,
  )
}

describe('App routing', () => {
  it('renders Today at /', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: /your next 14 days/i })).toBeInTheDocument()
  })

  it('renders Earnings at /earnings', async () => {
    renderAt('/earnings')
    expect(await screen.findByRole('heading', { name: /earnings workspace/i })).toBeInTheDocument()
  })

  it('renders Calendar at /calendar', async () => {
    renderAt('/calendar')
    expect(await screen.findByRole('heading', { name: /month view/i })).toBeInTheDocument()
  })

  it('renders Portfolio at /portfolio', async () => {
    renderAt('/portfolio')
    expect(await screen.findByRole('heading', { name: /^holdings$/i, level: 1 })).toBeInTheDocument()
  })

  it('renders Settings at /settings', async () => {
    renderAt('/settings')
    expect(await screen.findByText(/about this build/i)).toBeInTheDocument()
  })
})
