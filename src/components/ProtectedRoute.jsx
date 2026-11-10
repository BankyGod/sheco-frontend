import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../api/auth'

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
  }
  return <Outlet />
}
