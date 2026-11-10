import { useState } from 'react'
import { getSettings, updateSettings } from '../api/sales'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { getDeviceId } from '../utils/device'

export default function SettingsPage() {
  const { actor } = useAuth()
  const { online, queueCount, lastSyncMessage, syncNow, getCachedCatalogue } = useOffline()
  const [settings, setSettings] = useState(() => getSettings())
  const [message, setMessage] = useState('')
  const cached = getCachedCatalogue()

  function handleSave(e) {
    e.preventDefault()
    updateSettings(
      {
        discountLimitPercent: Number(settings.discountLimitPercent),
        sessionTimeoutMinutes: Number(settings.sessionTimeoutMinutes),
        offlineUnlockDays: Number(settings.offlineUnlockDays),
        expiryAlertDays: Number(settings.expiryAlertDays),
      },
      actor(),
    )
    setMessage('Settings saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Device, offline, and pharmacy configuration.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleSave} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
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
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              />
            </label>
          ))}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button type="submit" className="w-full rounded-xl bg-hospital py-3 font-semibold text-white">
            Save settings
          </button>
        </form>

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Device & sync</h3>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Device ID:</span> {getDeviceId()}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Connection:</span>{' '}
            {online ? 'Online' : 'Offline'}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Queued sales:</span> {queueCount}
          </p>
          <p className="text-sm">
            <span className="text-[var(--text-muted)]">Cached catalogue:</span>{' '}
            {cached ? `${cached.products.length} products · ${new Date(cached.savedAt).toLocaleString()}` : 'None yet'}
          </p>
          {lastSyncMessage ? (
            <p className="rounded-xl bg-hospital-light px-3 py-2 text-sm text-hospital-dark">
              {lastSyncMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => syncNow()}
            className="rounded-xl bg-canvas px-4 py-2.5 text-sm font-semibold"
          >
            Sync now
          </button>
        </div>
      </div>
    </div>
  )
}
