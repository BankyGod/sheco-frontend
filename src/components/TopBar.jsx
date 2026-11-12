import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Search,
  Wifi,
  WifiOff,
  CloudUpload,
  ChevronDown,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'

export default function TopBar({ searchValue = '', onSearchChange, searchPlaceholder = 'Search...' }) {
  const { user, logout, isAdmin, isOfflineUnlock } = useAuth()
  const {
    online,
    queueCount,
    queuedSales,
    syncNow,
    syncing,
    lastSyncMessage,
    catalogueAgeLabel,
    exportQueue,
  } = useOffline()

  const [openPanel, setOpenPanel] = useState(null)
  const wrapRef = useRef(null)

  const firstName = user?.name?.split(' ')[0] || 'User'
  const initial = (user?.name || 'S').charAt(0).toUpperCase()
  const roleLabel = isAdmin ? 'Admin' : 'Sales'
  const noticeCount =
    queueCount + (isOfflineUnlock ? 1 : 0) + (!online ? 1 : 0) + (lastSyncMessage?.toLowerCase().includes('fail') ? 1 : 0)

  useEffect(() => {
    function onDocClick(event) {
      if (!wrapRef.current?.contains(event.target)) setOpenPanel(null)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function toggle(panel) {
    setOpenPanel((current) => (current === panel ? null : panel))
  }

  return (
    <header className="flex items-center gap-2 px-0.5 py-0.5 md:gap-3 md:py-1" ref={wrapRef}>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] md:left-4"
          size={18}
        />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-2xl border border-transparent bg-white py-2.5 pl-10 pr-3 text-sm shadow-[var(--shadow)] outline-none focus:border-hospital md:rounded-full md:py-3 md:pl-11 md:pr-4"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <button
          type="button"
          onClick={() => syncNow()}
          disabled={syncing}
          className={`inline-flex h-11 items-center gap-1.5 rounded-2xl px-2.5 text-xs font-semibold transition disabled:opacity-60 md:rounded-full md:px-3 md:py-2 ${
            online
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-red-50 text-red-600 hover:bg-red-100'
          }`}
          title={
            online
              ? lastSyncMessage || `Catalogue ${catalogueAgeLabel}`
              : 'Offline — sales will queue on this device'
          }
        >
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden sm:inline">
            {syncing ? 'Syncing...' : online ? 'Online' : 'Offline'}
          </span>
          {queueCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 md:px-2">
              <CloudUpload size={12} /> {queueCount}
            </span>
          ) : null}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('notifications')}
            aria-expanded={openPanel === 'notifications'}
            aria-label="Notifications"
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition md:rounded-full ${
              openPanel === 'notifications'
                ? 'bg-hospital text-white'
                : 'bg-white text-hospital-dark shadow-[var(--shadow)] hover:bg-hospital-light'
            }`}
          >
            <Bell size={18} />
            {noticeCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                {noticeCount > 9 ? '9+' : noticeCount}
              </span>
            ) : null}
          </button>

          {openPanel === 'notifications' ? (
            <div className="absolute right-0 z-40 mt-2 w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-[var(--text-muted)]">Device sync and sales alerts</p>
              </div>

              <div className="max-h-[360px] space-y-1 overflow-y-auto p-2">
                {!online ? (
                  <NoticeRow
                    tone="red"
                    icon={WifiOff}
                    title="You're offline"
                    body="Sales will queue on this device until connection returns."
                  />
                ) : null}

                {isOfflineUnlock ? (
                  <NoticeRow
                    tone="amber"
                    icon={AlertTriangle}
                    title="Offline unlock session"
                    body="Sign in online to sync queued sales to the server."
                  />
                ) : null}

                {queueCount > 0 ? (
                  <NoticeRow
                    tone="blue"
                    icon={CloudUpload}
                    title={`${queueCount} sale${queueCount === 1 ? '' : 's'} waiting to sync`}
                    body={
                      queuedSales[0]
                        ? `Latest: ${queuedSales[queuedSales.length - 1]?.receiptNumber || 'queued receipt'}`
                        : 'Stored on this device until sync succeeds.'
                    }
                  />
                ) : (
                  <NoticeRow
                    tone="green"
                    icon={Bell}
                    title="All clear"
                    body="No queued sales on this device."
                  />
                )}

                {lastSyncMessage ? (
                  <NoticeRow
                    tone="slate"
                    icon={RefreshCw}
                    title="Last sync"
                    body={lastSyncMessage}
                  />
                ) : null}

                <div className="rounded-xl bg-canvas px-3 py-2 text-xs text-[var(--text-muted)]">
                  Catalogue cache: {catalogueAgeLabel}
                </div>
              </div>

              <div className="flex gap-2 border-t border-[var(--border)] p-3">
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => syncNow()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-hospital px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <RefreshCw size={13} />
                  {syncing ? 'Syncing...' : 'Sync now'}
                </button>
                {queueCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => exportQueue()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-canvas px-3 py-2 text-xs font-semibold text-hospital-dark"
                    title="Download unsynced sales backup"
                  >
                    <Download size={13} />
                    Backup
                  </button>
                ) : null}
                {isAdmin ? (
                  <Link
                    to="/needs-review"
                    onClick={() => setOpenPanel(null)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-canvas px-3 py-2 text-xs font-semibold text-hospital-dark"
                  >
                    <AlertTriangle size={13} />
                    Review
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('account')}
            aria-expanded={openPanel === 'account'}
            className={`flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 transition ${
              openPanel === 'account'
                ? 'bg-hospital-light ring-1 ring-hospital/30'
                : 'bg-white shadow-[var(--shadow)] hover:bg-hospital-light/70'
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hospital text-sm font-bold text-white">
              {initial}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-semibold text-[var(--text)]">{firstName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{roleLabel}</p>
            </div>
            <ChevronDown
              size={14}
              className={`text-[var(--text-muted)] transition ${openPanel === 'account' ? 'rotate-180' : ''}`}
            />
          </button>

          {openPanel === 'account' ? (
            <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">@{user?.username || roleLabel}</p>
              </div>
              <div className="p-2">
                {isAdmin ? (
                  <Link
                    to="/settings"
                    onClick={() => setOpenPanel(null)}
                    className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] hover:bg-canvas"
                  >
                    Settings
                  </Link>
                ) : null}
                <Link
                  to="/sales"
                  onClick={() => setOpenPanel(null)}
                  className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] hover:bg-canvas"
                >
                  {isAdmin ? 'Sales' : 'My sales'}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpenPanel(null)
                    logout()
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function NoticeRow({ tone, icon: Icon, title, body }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-hospital-light text-hospital-dark',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-canvas text-[var(--text-muted)]',
  }
  return (
    <div className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas/80">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tones[tone] || tones.slate}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{body}</p>
      </div>
    </div>
  )
}
