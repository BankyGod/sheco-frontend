import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OfflineProvider } from './context/OfflineContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import PosLayout from './layouts/PosLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import ProductsPage from './pages/ProductsPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import PosPage from './pages/PosPage'
import ReceiptPage from './pages/ReceiptPage'
import ReportsPage from './pages/ReportsPage'
import AuditPage from './pages/AuditPage'
import SettingsPage from './pages/SettingsPage'
import { ROLES } from './api/auth'

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<ProtectedRoute roles={[ROLES.SUPER_ADMIN]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.SALESPERSON]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales/:id" element={<ReceiptPage />} />
            </Route>
            <Route element={<PosLayout />}>
              <Route path="/pos" element={<PosPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OfflineProvider>
    </AuthProvider>
  )
}
