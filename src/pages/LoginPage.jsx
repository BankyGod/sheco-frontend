import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getOfflineUnlockMeta, ROLES, saveOfflinePin } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import PinInput from '../components/PinInput'

export default function LoginPage() {
  const { login, unlockOffline, isAuthenticated, user } = useAuth()
  const { online, syncNow, queueCount } = useOffline()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const unlockMeta = getOfflineUnlockMeta()

  const resumeOnline = searchParams.get('resume') === 'online'
  const resumeQueued = Number(searchParams.get('queued') || 0)
  const resumeUser = searchParams.get('user') || ''

  // Connectivity decides the login form — no manual tab switching.
  const mode = online ? 'online' : 'offline'

  const [username, setUsername] = useState(() => resumeUser || unlockMeta?.username || '')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('login')

  const banner = useMemo(() => {
    if (step === 'setup-pin') return null
    if (resumeOnline && online) {
      return {
        tone: 'green',
        text:
          resumeQueued > 0
            ? `Internet is back. Sign in online to sync ${resumeQueued} queued sale${resumeQueued === 1 ? '' : 's'}.`
            : 'Internet is back. Sign in online to continue with full sync.',
      }
    }
    if (!online) {
      return {
        tone: 'red',
        text: 'No internet. Unlock offline with your username and 4-digit PIN. Sales will save on this device and sync later.',
      }
    }
    return {
      tone: 'muted',
      text: 'Online sign-in. After this, you can create a 4-digit PIN for offline unlock on this device.',
    }
  }, [online, resumeOnline, resumeQueued, step])

  useEffect(() => {
    if (!online) {
      setPassword('')
      setError('')
      if (unlockMeta?.username) setUsername((current) => current || unlockMeta.username)
    }
  }, [online, unlockMeta])

  useEffect(() => {
    if (resumeUser) setUsername(resumeUser)
  }, [resumeUser])

  if (isAuthenticated && step !== 'setup-pin') {
    return <Navigate to={user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos'} replace />
  }

  function goAfterAuth(session) {
    setSearchParams({})
    navigate(session.user.role === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!online) {
        const session = await unlockOffline(username, pin)
        goAfterAuth(session)
        return
      }

      let session
      try {
        session = await login(username, password)
      } catch (err) {
        if (err?.status === 0 || /offline|reach the Sheco server/i.test(err?.message || '')) {
          setError('Connection dropped. Use offline unlock with your 4-digit PIN.')
          setPin('')
          return
        }
        throw err
      }

      const meta = getOfflineUnlockMeta()
      if (!meta?.hasPin) {
        setPin('')
        setConfirmPin('')
        setStep('setup-pin')
        return
      }

      if (queueCount > 0) {
        await syncNow()
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
      setSearchParams({})
      navigate((user?.role || getOfflineUnlockMeta()?.role) === ROLES.SUPER_ADMIN ? '/dashboard' : '/pos')
    } catch (err) {
      setError(err.message || 'Could not save offline PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
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
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-hospital-dark">
            {mode === 'online' ? 'Online sign-in' : 'Offline unlock'}
          </p>
        </div>

        {step === 'setup-pin' ? (
          <form onSubmit={handleSetupPin} className="space-y-5">
            <div className="rounded-xl bg-hospital-light px-3 py-3 text-sm text-hospital-dark">
              Create a <strong>4-digit offline PIN</strong> for this device. When there is no internet,
              Sheco will ask for this PIN so you can keep making sales offline.
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
            {banner ? (
              <p
                className={`mb-4 rounded-xl px-3 py-2 text-sm ${
                  banner.tone === 'red'
                    ? 'bg-red-50 text-red-700'
                    : banner.tone === 'green'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-canvas text-[var(--text-muted)]'
                }`}
              >
                {banner.text}
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
                      No offline PIN on this device yet. Connect to the internet and sign in online
                      first to create one.
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
