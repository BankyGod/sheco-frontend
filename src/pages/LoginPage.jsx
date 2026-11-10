import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../api/auth'
import { useOffline } from '../context/OfflineContext'

export default function LoginPage() {
  const { login, unlockOffline, isAuthenticated, user } = useAuth()
  const { online } = useOffline()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('online')

  if (isAuthenticated) {
    return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session =
        mode === 'offline' || !online
          ? await unlockOffline(username, password)
          : await login(username, password)
      navigate(session.user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos')
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#d6ebf7,_transparent_45%),radial-gradient(circle_at_bottom_right,_#e8f4fb,_transparent_40%)]" />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-[var(--shadow)]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Sheco<span className="text-hospital">.</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Pharmacy Management System</p>
        </div>

        <div className="mb-4 flex rounded-xl bg-canvas p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 font-medium ${mode === 'online' ? 'bg-white text-hospital-dark shadow-sm' : 'text-[var(--text-muted)]'}`}
            onClick={() => setMode('online')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 font-medium ${mode === 'offline' ? 'bg-white text-hospital-dark shadow-sm' : 'text-[var(--text-muted)]'}`}
            onClick={() => setMode('offline')}
          >
            Offline unlock
          </button>
        </div>

        {!online ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
            You are offline. Use offline unlock with your password or PIN if this device was signed in before.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-3 outline-none focus:border-hospital"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              {mode === 'offline' ? 'Password or PIN' : 'Password'}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-3 outline-none focus:border-hospital"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark disabled:opacity-60"
          >
            {loading ? 'Signing in...' : mode === 'offline' ? 'Unlock offline' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl bg-hospital-light p-4 text-xs text-hospital-dark">
          <p className="font-semibold">Demo accounts</p>
          <p className="mt-1">Admin: admin / admin123</p>
          <p>Sales: kwame / sale123 (PIN 2222)</p>
        </div>
      </div>
    </div>
  )
}
