import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PortfolioProvider } from '@/context/PortfolioContext'
import { AppShell } from '@/components/layout/AppShell'
import { TodayPage } from '@/pages/TodayPage'
import { EarningsPage } from '@/pages/EarningsPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PerformancePage } from '@/pages/PerformancePage'

export default function App() {
  return (
    <PortfolioProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="performance" element={<PerformancePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PortfolioProvider>
  )
}
