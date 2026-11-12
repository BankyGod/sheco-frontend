import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getOfflineUnlockMeta, ROLES, saveOfflinePin } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import PinInput from '../components/PinInput'

export default function LoginPage() {
  const { login, unlockOffline, isAuthenticated, user } = useAuth()
  const { online, syncNow, queueCount } = useOffline()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('login')
  const [mode, setMode] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  )
  const unlockMeta = getOfflineUnlockMeta()

  useEffect(() => {
    if (!online) setMode('offline')
  }, [online])

  useEffect(() => {
    if (mode === 'offline' && unlockMeta?.username && !username) {
      setUsername(unlockMeta.username)
    }
  }, [mode, unlockMeta, username])

  if (isAuthenticated && step !== 'setup-pin') {
    return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
  }

  function goAfterAuth(session) {
    navigate(session.user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const goingOffline = mode === 'offline' || !online
      let session
      if (goingOffline) {
        session = await unlockOffline(username, pin)
      } else {
        try {
          session = await login(username, password)
        } catch (err) {
          if (err?.status === 0 || /offline|reach the Sheco server/i.test(err?.message || '')) {
            session = await unlockOffline(username, pin || password)
          } else {
            throw err
          }
        }

        const meta = getOfflineUnlockMeta()
        if (!meta?.hasPin) {
          setPin('')
          setConfirmPin('')
          setStep('setup-pin')
          setLoading(false)
          return
        }

        if (queueCount > 0) {
          await syncNow()
        }
      }
      goAfterAuth(session)
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetupPin(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }
    if (pin !== confirmPin) {
      setError('PIN confirmation does not match')
      return
    }
    setLoading(true)
    try {
      await saveOfflinePin(pin)
      if (queueCount > 0) await syncNow()
      const sessionUser = user || getOfflineUnlockMeta()
      navigate(
        (user?.role || sessionUser?.role) === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos',
      )
    } catch (err) {
      setError(err.message || 'Could not save offline PIN')
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

        {step === 'setup-pin' ? (
          <form onSubmit={handleSetupPin} className="space-y-5">
            <div className="rounded-xl bg-hospital-light px-3 py-3 text-sm text-hospital-dark">
              Create a <strong>4-digit offline PIN</strong> for this device. You will use it to unlock
              Sheco when there is no internet.
            </div>
            <div>
              <p className="mb-3 text-center text-sm font-medium">Offline PIN</p>
              <PinInput value={pin} onChange={setPin} autoFocus idPrefix="setup-pin" />
            </div>
            <div>
              <p className="mb-3 text-center text-sm font-medium">Confirm PIN</p>
              <PinInput value={confirmPin} onChange={setConfirmPin} idPrefix="confirm-pin" />
            </div>
            {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
              className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save offline PIN'}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-4 flex rounded-xl bg-canvas p-1 text-sm">
              <button
                type="button"
                className={`flex-1 rounded-lg px-3 py-2 font-medium ${mode === 'online' ? 'bg-white text-hospital-dark shadow-sm' : 'text-[var(--text-muted)]'}`}
                onClick={() => {
                  setMode('online')
                  setError('')
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg px-3 py-2 font-medium ${mode === 'offline' ? 'bg-white text-hospital-dark shadow-sm' : 'text-[var(--text-muted)]'}`}
                onClick={() => {
                  setMode('offline')
                  setError('')
                  setPin('')
                }}
              >
                Offline unlock
              </button>
            </div>

            {!online ? (
              <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                You are offline. Unlock with your username and 4-digit PIN from this device.
              </p>
            ) : mode === 'offline' ? (
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Use the 4-digit offline PIN created after your last online sign-in on this device.
              </p>
            ) : (
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Tip: sign in online once on this device, then set a 4-digit PIN for offline unlock.
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

              {mode === 'online' ? (
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
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium">4-digit PIN</p>
                  <PinInput value={pin} onChange={setPin} autoFocus idPrefix="offline-pin" />
                  {!unlockMeta?.hasPin ? (
                    <p className="mt-3 text-xs text-amber-700">
                      No offline PIN is saved on this device yet. Sign in online first to create one.
                    </p>
                  ) : null}
                </div>
              )}

              {error ? <p className="text-sm text-red-500">{error}</p> : null}

              <button
                type="submit"
                disabled={loading || (mode === 'offline' && pin.length !== 4)}
                className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark disabled:opacity-60"
              >
                {loading ? 'Signing in...' : mode === 'offline' ? 'Unlock offline' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
