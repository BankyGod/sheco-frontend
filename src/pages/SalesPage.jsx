import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { getQueuedSales, listSales, voidSale } from '../api/sales'
import { listUsers } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { formatGhs } from '../utils/money'
import { getCachedSales, getCachedUsers, setCachedSales } from '../utils/offlineStore'

function mergeSales(serverRows, queuedRows) {
  const byId = new Map()
  for (const sale of serverRows || []) byId.set(sale.id, sale)
  for (const sale of queuedRows || []) {
    if (!byId.has(sale.id)) byId.set(sale.id, { ...sale, status: sale.status || 'queued' })
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export default function SalesPage() {
  const { isAdmin } = useAuth()
  const { search = '' } = useOutletContext() || {}
  const [sales, setSales] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [voidingId, setVoidingId] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const queued = await getQueuedSales()
      try {
        const [saleRows, userRows] = await Promise.all([
          listSales(),
          isAdmin ? listUsers() : Promise.resolve([]),
        ])
        const merged = mergeSales(saleRows, queued)
        setSales(merged)
        setUsers(userRows)
        setFromCache(false)
        setError('')
        await setCachedSales(merged)
      } catch {
        const [cachedSales, cachedUsers] = await Promise.all([
          getCachedSales(),
          isAdmin ? getCachedUsers() : Promise.resolve(null),
        ])
        const merged = mergeSales(cachedSales?.sales || [], queued)
        setSales(merged)
        setUsers(cachedUsers?.users || [])
        setFromCache(true)
        setError('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = sales.filter((sale) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return sale.receiptNumber.toLowerCase().includes(q) || sale.payment.method.includes(q)
  })

  async function handleVoid(saleId) {
    setError('')
    try {
      await voidSale(saleId, reason)
      setVoidingId(null)
      setReason('')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{isAdmin ? 'Sales' : 'My Sales'}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {isAdmin ? 'All completed and voided sales.' : 'Your own sales history only.'}
          </p>
        </div>
        <Link to="/pos" className="rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white">
          New sale
        </Link>
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved sales on this device. Queued offline sales are included and will sync when
          you sign in online.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Loading sales...</p>
        ) : filtered.length ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">When</th>
                {isAdmin ? <th className="px-4 py-3 font-medium">Salesperson</th> : null}
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => {
                const seller =
                  sale.salespersonName ||
                  users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
                  sale.salespersonId
                return (
                  <tr key={sale.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{sale.receiptNumber}</td>
                    <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                    {isAdmin ? <td className="px-4 py-3">{seller}</td> : null}
                    <td className="px-4 py-3 uppercase">
                      {sale.payment.method}
                      {sale.payment.network ? ` · ${sale.payment.network}` : ''}
                    </td>
                    <td className="px-4 py-3">{formatGhs(sale.total)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          sale.status === 'voided'
                            ? 'bg-red-50 text-red-600'
                            : sale.syncFlag === 'queued' || sale.status === 'queued'
                              ? 'bg-amber-50 text-amber-700'
                              : sale.needsReview
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {sale.syncFlag === 'queued' || sale.status === 'queued'
                          ? 'Queued'
                          : sale.needsReview
                            ? 'Needs review'
                            : sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/sales/${sale.id}`}
                          state={{ sale }}
                          className="inline-flex items-center rounded-lg border border-hospital-soft bg-hospital-light px-3 py-1.5 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
                        >
                          Receipt
                        </Link>
                        {isAdmin && sale.status === 'completed' && sale.syncFlag !== 'queued' && !fromCache ? (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white"
                            onClick={() => setVoidingId(sale.id)}
                          >
                            Void
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            No sales saved on this device yet. Open Sales once while online, or complete an offline
            sale from POS.
          </p>
        )}
      </div>

      {voidingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Void sale</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              A reason is required. Stock will be restored.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              rows={3}
              placeholder="Reason for void"
            />
            {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-500 py-2.5 font-semibold text-white"
                onClick={() => handleVoid(voidingId)}
              >
                Confirm void
              </button>
              <button
                type="button"
                className="rounded-xl bg-canvas px-4 py-2.5 font-semibold"
                onClick={() => {
                  setVoidingId(null)
                  setReason('')
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
