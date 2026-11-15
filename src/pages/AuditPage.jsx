import { useEffect, useState } from 'react'
import { Clock, LayoutGrid, List, Search, Smartphone } from 'lucide-react'
import { listAuditLog } from '../api/sales'
import { getCachedAudit } from '../utils/offlineStore'

export default function AuditPage() {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const rows = await listAuditLog(query)
        if (active) {
          setEntries(rows)
          setFromCache(false)
          setError('')
        }
      } catch (err) {
        if (!active) return
        const cached = await getCachedAudit()
        if (cached?.entries?.length) {
          const q = query.trim().toLowerCase()
          setEntries(
            q
              ? cached.entries.filter((row) =>
                  JSON.stringify(row).toLowerCase().includes(q),
                )
              : cached.entries,
          )
          setFromCache(true)
          setError('')
        } else {
          setError(err.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Audit Log</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Trace system sign-ins, sales, voids, price modifications, restocks, and user changes.
          </p>
        </div>

        {/* Mobile View Toggle */}
        <div className="inline-flex self-start rounded-xl bg-canvas p-1 md:hidden">
          <button
            type="button"
            onClick={() => setMobileViewMode('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mobileViewMode === 'cards'
                ? 'bg-white font-semibold text-hospital-dark shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mobileViewMode === 'table'
                ? 'bg-white font-semibold text-hospital-dark shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <List size={14} /> Table
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-lg">
        <Search size={16} className="absolute left-3.5 top-3.5 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action, user, or record..."
          className="w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-4 py-2.5 text-sm shadow-[var(--shadow)] outline-none focus:border-hospital"
        />
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved audit entries on this device.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="font-semibold text-[var(--text)]">Audit Entries</span>
          <span className="text-xs text-[var(--text-muted)]">{entries.length} logged</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Loading audit log...</p>
        ) : entries.length ? (
          <>
            {/* Mobile Card Layout */}
            <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{entry.userName || 'System'}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Clock size={12} />
                        {new Date(entry.time).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-hospital-light px-2.5 py-1 text-xs font-semibold text-hospital-dark uppercase">
                      {entry.action}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                        Record Details
                      </p>
                      <p className="break-words font-medium text-sm text-[var(--text)] mt-0.5">
                        {entry.record || '—'}
                      </p>
                    </div>
                    {entry.deviceId ? (
                      <div className="rounded-xl bg-white p-2 border border-[var(--border)] flex items-center gap-1.5">
                        <Smartphone size={13} className="text-[var(--text-muted)] shrink-0" />
                        <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                          Device: {entry.deviceId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {/* Table Layout */}
            <div className={mobileViewMode === 'table' ? 'block' : 'hidden md:block'}>
              {mobileViewMode === 'table' && (
                <p className="px-4 py-1.5 text-[11px] text-[var(--text-muted)] bg-slate-50 border-b border-[var(--border)] md:hidden">
                  ← Swipe table horizontally to view all columns →
                </p>
              )}
              <div className="table-scroll">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                        Time
                      </th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Device</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                        <td className="sticky left-0 bg-white z-10 whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)] shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                          {new Date(entry.time).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{entry.userName}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{entry.deviceId || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-full bg-hospital-light px-2.5 py-0.5 text-xs font-semibold text-hospital-dark">
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-md break-words">{entry.record}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-[var(--text-muted)]">No audit entries found.</p>
        )}
      </div>
    </div>
  )
}
