import { useEffect, useState } from 'react'
import {
  changePassword,
  changePin,
  refreshOfflineUnlock,
  updateProfile,
} from '../api/auth'
import { getSettings, purgeOperationalData, updateSettings } from '../api/sales'
import { saveQueuedSales, setCachedCatalogue } from '../utils/offlineStore'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { getDeviceId } from '../utils/device'

export default function SettingsPage() {
  const { user, updateUser, isOfflineUnlock } = useAuth()
  const {
    online,
    queueCount,
    lastSyncMessage,
    syncNow,
    exportQueue,
    catalogueMeta,
    catalogueAgeLabel,
    syncing,
  } = useOffline()
  const [settings, setSettings] = useState(null)
  const [profile, setProfile] = useState({ name: '', username: '' })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [pinForm, setPinForm] = useState({
    currentPassword: '',
    newPin: '',
    confirmPin: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const cached = catalogueMeta

  useEffect(() => {
    let active = true
    setProfile({
      name: user?.name || '',
      username: user?.username || '',
    })
    getSettings()
      .then((rows) => {
        if (active) setSettings(rows)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [user])

  function flash(okMessage) {
    setError('')
    setMessage(okMessage)
  }

  async function handleProfileSave(e) {
    e.preventDefault()
    setSaving('profile')
    setError('')
    try {
      const updated = await updateProfile({
        name: profile.name.trim(),
        username: profile.username.trim(),
      })
      updateUser(updated)
      await refreshOfflineUnlock({
        username: updated.username,
        name: updated.name,
        role: updated.role,
      })
      flash('Account details updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault()
    setSaving('password')
    setError('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match')
      setSaving('')
      return
    }
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      await refreshOfflineUnlock({
        username: user.username,
        name: user.name,
        role: user.role,
        password: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      flash('Password changed')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  async function handlePinSave(e) {
    e.preventDefault()
    setSaving('pin')
    setError('')
    if (pinForm.newPin !== pinForm.confirmPin) {
      setError('New PIN and confirmation do not match')
      setSaving('')
      return
    }
    try {
      await changePin({
        currentPassword: pinForm.currentPassword,
        newPin: pinForm.newPin,
      })
      setPinForm({ currentPassword: '', newPin: '', confirmPin: '' })
      flash('Offline PIN updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  async function handlePharmacySave(e) {
    e.preventDefault()
    setSaving('pharmacy')
    setError('')
    try {
      const saved = await updateSettings({
        pharmacyName: settings.pharmacyName,
        pharmacyPhone: settings.pharmacyPhone,
        pharmacyAddress: settings.pharmacyAddress,
        pharmacyEmail: settings.pharmacyEmail,
        receiptFooter: settings.receiptFooter,
        momoAccountName: settings.momoAccountName,
        momoAccountNumber: settings.momoAccountNumber,
      })
      setSettings(saved)
      flash('Pharmacy details saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  async function handleRulesSave(e) {
    e.preventDefault()
    setSaving('rules')
    setError('')
    try {
      const saved = await updateSettings({
        discountLimitPercent: Number(settings.discountLimitPercent),
        sessionTimeoutMinutes: Number(settings.sessionTimeoutMinutes),
        offlineUnlockDays: Number(settings.offlineUnlockDays),
        expiryAlertDays: Number(settings.expiryAlertDays),
      })
      setSettings(saved)
      flash('Pharmacy rules saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  if (!settings && !error) {
    return <p className="text-sm text-[var(--text-muted)]">Loading settings...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage your account, pharmacy details, rules, and device sync.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleProfileSave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Account</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Role: <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Display name</span>
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Username</span>
            <input
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
            />
          </label>
          <button
            type="submit"
            disabled={saving === 'profile'}
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving === 'profile' ? 'Saving...' : 'Save account'}
          </button>
        </form>

        <form onSubmit={handlePasswordSave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Change password</h3>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Current password</span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New password</span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
              minLength={6}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Confirm new password</span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
              minLength={6}
            />
          </label>
          <button
            type="submit"
            disabled={saving === 'password'}
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving === 'password' ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <form onSubmit={handlePinSave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Offline PIN</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Used for offline unlock on this device after a successful online sign-in.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Current password</span>
            <input
              type="password"
              value={pinForm.currentPassword}
              onChange={(e) => setPinForm({ ...pinForm, currentPassword: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New PIN</span>
            <input
              type="password"
              value={pinForm.newPin}
              onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
              minLength={4}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Confirm PIN</span>
            <input
              type="password"
              value={pinForm.confirmPin}
              onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
              required
              minLength={4}
            />
          </label>
          <button
            type="submit"
            disabled={saving === 'pin'}
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving === 'pin' ? 'Updating...' : 'Update PIN'}
          </button>
        </form>

        {settings ? (
          <form onSubmit={handlePharmacySave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
            <h3 className="text-lg font-semibold">Pharmacy details</h3>
            {[
              ['pharmacyName', 'Pharmacy name'],
              ['pharmacyPhone', 'Phone'],
              ['pharmacyEmail', 'Email'],
              ['pharmacyAddress', 'Address'],
              ['receiptFooter', 'Receipt footer'],
              ['momoAccountName', 'MoMo account name'],
              ['momoAccountNumber', 'MoMo account number'],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-medium">{label}</span>
                <input
                  value={settings[key] || ''}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={saving === 'pharmacy'}
              className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving === 'pharmacy' ? 'Saving...' : 'Save pharmacy details'}
            </button>
          </form>
        ) : null}

        {settings ? (
          <form onSubmit={handleRulesSave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
            <h3 className="text-lg font-semibold">Pharmacy rules</h3>
            {[
              ['discountLimitPercent', 'Discount limit (%)'],
              ['sessionTimeoutMinutes', 'Session timeout (minutes)'],
              ['offlineUnlockDays', 'Offline unlock period (days)'],
              ['expiryAlertDays', 'Expiry alert window (days)'],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-medium">{label}</span>
                <input
                  type="number"
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={saving === 'rules'}
              className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving === 'rules' ? 'Saving...' : 'Save rules'}
            </button>
          </form>
        ) : null}

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Device & sync</h3>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Device ID:</span> {getDeviceId()}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Connection:</span>{' '}
            {online ? 'Online' : 'Offline'}
            {isOfflineUnlock ? ' · Offline unlock (sign in online to sync)' : ''}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Queued sales:</span> {queueCount}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Cached catalogue:</span>{' '}
            {cached
              ? `${cached.products.length} products · ${catalogueAgeLabel} (${new Date(cached.savedAt).toLocaleString()})`
              : 'None yet'}
          </p>
          {lastSyncMessage ? (
            <p className="rounded-xl bg-hospital-light px-3 py-2 text-sm text-hospital-dark">
              {lastSyncMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => syncNow()}
              className="rounded-xl bg-canvas px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
            <button
              type="button"
              disabled={!queueCount}
              onClick={() => exportQueue()}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-hospital-dark shadow-[var(--shadow)] disabled:opacity-60"
            >
              Download unsynced sales
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Download a backup of queued sales before clearing browser data. Sync removes only
            sales accepted by the server.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-red-100 bg-white p-5 shadow-[var(--shadow)] xl:col-span-2">
          <h3 className="text-lg font-semibold text-red-700">Danger zone</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Remove all products, batches, sales, audits, and salesperson accounts. Keeps only the
            admin account and pharmacy settings. This cannot be undone.
          </p>
          <button
            type="button"
            disabled={saving === 'purge'}
            onClick={async () => {
              const ok = window.confirm(
                'Delete ALL inventory and non-admin accounts? Only the admin login will remain.',
              )
              if (!ok) return
              const typed = window.prompt('Type PURGE to confirm')
              if (typed !== 'PURGE') {
                setError('Purge cancelled — confirmation text did not match.')
                return
              }
              setSaving('purge')
              setError('')
              try {
                const result = await purgeOperationalData()
                await saveQueuedSales([])
                await setCachedCatalogue([])
                flash(
                  `Cleared pharmacy data. Admin left: ${result.adminUsername || 'admin'}. Removed ${result.usersRemoved ?? 0} user(s), ${result.products ?? 0} product(s), ${result.sales ?? 0} sale(s).`,
                )
              } catch (err) {
                setError(err.message)
              } finally {
                setSaving('')
              }
            }}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving === 'purge' ? 'Purging...' : 'Clear inventory & non-admin accounts'}
          </button>
        </div>
      </div>
    </div>
  )
}
