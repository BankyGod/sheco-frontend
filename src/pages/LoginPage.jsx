import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../api/auth'
import { useOffline } from '../context/OfflineContext'

export default function LoginPage() {
  const { login, unlockOffline, isAuthenticated, user } = useAuth()
  const { online, syncNow, queueCount } = useOffline()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(() => (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'))

  useEffect(() => {
    if (!online) setMode('offline')
  }, [online])

  if (isAuthenticated) {
    return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const goingOffline = mode === 'offline' || !online
      let session
      if (goingOffline) {
        session = await unlockOffline(username, password)
      } else {
        try {
          session = await login(username, password)
        } catch (err) {
          // Network down mid-login: fall back to offline unlock if available.
          if (err?.status === 0 || /offline|reach the Sheco server/i.test(err?.message || '')) {
            session = await unlockOffline(username, password)
          } else {
            throw err
          }
        }
      }
      if (!goingOffline && !session.offlineUnlock && queueCount > 0) {
        await syncNow()
      }
      navigate(session.user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos')
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login-pharmacy-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,40,60,0.72),rgba(46,123,168,0.55))]" />

      <div className="relative w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-[var(--shadow)] backdrop-blur-sm">
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
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            You are offline. Use Offline unlock with the same password from your last online sign-in
            on this device.
          </p>
        ) : (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Tip: sign in online once on this device so Offline unlock works during outages.
          </p>
        )}

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
            <span className="mb-1 block font-medium">Password</span>
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
      </div>
    </div>
  )
}
