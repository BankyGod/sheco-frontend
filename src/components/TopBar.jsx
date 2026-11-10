import { Bell, Search, Wifi, WifiOff, CloudUpload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'

export default function TopBar({ searchValue = '', onSearchChange, searchPlaceholder = 'Search...' }) {
  const { user, logout } = useAuth()
  const { online, queueCount, syncNow } = useOffline()

  return (
    <header className="flex flex-wrap items-center gap-4 px-2 py-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-full border border-transparent bg-white py-3 pl-11 pr-4 text-sm shadow-[var(--shadow)] outline-none focus:border-hospital"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => syncNow()}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
            online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}
          title={online ? 'Online' : 'Offline'}
        >
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'Online' : 'Offline'}
          {queueCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
              <CloudUpload size={12} /> {queueCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-hospital-light text-hospital-dark"
        >
          <Bell size={18} />
          {queueCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-hospital px-1 text-[10px] font-bold text-white">
              {queueCount}
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-[var(--shadow)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hospital text-sm font-bold text-white">
            {user?.name?.charAt(0) || 'S'}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Hello, {user?.name?.split(' ')[0]}</p>
            <button type="button" onClick={logout} className="text-xs text-[var(--text-muted)] hover:text-hospital-dark">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
