import { useEffect, useState } from 'react'
import { listAuditLog } from '../api/sales'
import { getCachedAudit } from '../utils/offlineStore'

export default function AuditPage() {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

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
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Audit Log</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Sign-ins, sales, voids, price changes, stock adjustments, and user changes.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search action, user, or record..."
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow)] outline-none focus:border-hospital"
      />

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved audit entries on this device.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="md:overflow-hidden md:rounded-2xl md:bg-white md:shadow-[var(--shadow)]">
        {loading ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-[var(--text-muted)] shadow-[var(--shadow)] md:rounded-none md:p-6 md:shadow-none">
            Loading audit log...
          </p>
        ) : entries.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-2xl bg-white p-4 shadow-[var(--shadow)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{entry.userName || '—'}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {new Date(entry.time).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-hospital-light px-2 py-1 text-[10px] font-semibold text-hospital-dark">
                      {entry.action}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                    <div className="rounded-xl bg-canvas px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        Record
                      </p>
                      <p className="break-words font-medium">{entry.record || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-canvas px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        Device
                      </p>
                      <p className="break-all font-medium text-[var(--text-muted)]">
                        {entry.deviceId || '—'}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <div className="table-scroll">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Device</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-[var(--border)]">
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(entry.time).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{entry.userName}</td>
                        <td className="px-4 py-3">{entry.deviceId}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-hospital-light px-2 py-1 text-xs font-semibold text-hospital-dark">
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">{entry.record}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-sm text-[var(--text-muted)] shadow-[var(--shadow)] md:rounded-none md:p-6 md:shadow-none">
            No audit entries found.
          </p>
        )}
      </div>
    </div>
  )
}
