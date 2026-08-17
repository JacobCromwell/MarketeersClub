import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'

const AgreementsPage = lazy(() => import('./pages/AgreementsPage').then((module) => ({ default: module.AgreementsPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((module) => ({ default: module.InventoryPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })))
const TeamsPage = lazy(() => import('./pages/TeamsPage').then((module) => ({ default: module.TeamsPage })))
const TripsPage = lazy(() => import('./pages/TripsPage').then((module) => ({ default: module.TripsPage })))

function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="app-loading">Marketeers Club</div>
  if (!user) return <AuthPage />

  return (
    <Suspense fallback={<div className="app-loading">Loading</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="agreements" element={<AgreementsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App