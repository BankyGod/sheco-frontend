import { useMemo, useState } from 'react'
import { listAuditLog } from '../api/sales'

export default function AuditPage() {
  const [query, setQuery] = useState('')
  const entries = useMemo(() => listAuditLog(query), [query])

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

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
        <table className="w-full text-left text-sm">
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
                <td className="px-4 py-3 whitespace-nowrap">
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
  )
}
