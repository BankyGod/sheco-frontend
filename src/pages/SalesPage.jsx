import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { LayoutGrid, List, PlusCircle, Receipt, XCircle } from 'lucide-react'
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
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'

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
    return (
      sale.receiptNumber?.toLowerCase().includes(q) ||
      sale.payment?.method?.toLowerCase().includes(q) ||
      sellerName(sale).toLowerCase().includes(q)
    )
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

  function sellerName(sale) {
    return (
      sale.salespersonName ||
      users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
      sale.salespersonId ||
      'Staff'
    )
  }

  function statusLabel(sale) {
    if (sale.syncFlag === 'queued' || sale.status === 'queued') return 'Queued'
    if (sale.needsReview) return 'Needs review'
    return sale.status
  }

  function statusClass(sale) {
    if (sale.status === 'voided') return 'bg-red-50 text-red-600'
    if (sale.syncFlag === 'queued' || sale.status === 'queued') return 'bg-amber-50 text-amber-700'
    if (sale.needsReview) return 'bg-orange-50 text-orange-700'
    return 'bg-emerald-50 text-emerald-700'
  }

  function paymentLabel(sale) {
    return `${sale.payment?.method || 'Cash'}${
      sale.payment?.network ? ` · ${sale.payment.network}` : ''
    }`
  }

  function saleActions(sale) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/sales/${sale.id}`}
          state={{ sale }}
          className="inline-flex items-center gap-1 rounded-xl border border-hospital-soft bg-hospital-light px-3 py-1.5 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
        >
          <Receipt size={13} />
          Receipt
        </Link>
        {isAdmin && sale.status === 'completed' && sale.syncFlag !== 'queued' && !fromCache ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white"
            onClick={() => setVoidingId(sale.id)}
          >
            <XCircle size={13} />
            Void
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{isAdmin ? 'Sales History' : 'My Sales'}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {isAdmin ? 'All completed, queued offline, and voided transactions.' : 'Your own sales transactions.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile View Toggle */}
          <div className="inline-flex rounded-xl bg-canvas p-1 md:hidden">
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

          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-hospital-dark"
          >
            <PlusCircle size={16} /> New sale
          </Link>
        </div>
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved sales on this device. Queued offline sales are included and will sync when
          you sign in online.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="font-semibold text-[var(--text)]">Transactions</span>
          <span className="text-xs text-[var(--text-muted)]">{filtered.length} sales</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Loading sales...</p>
        ) : filtered.length ? (
          <>
            {/* Mobile Card Layout */}
            <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
              {filtered.map((sale) => (
                <article
                  key={sale.id}
                  className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-hospital-dark truncate">
                        {sale.receiptNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {new Date(sale.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusClass(
                        sale,
                      )}`}
                    >
                      {statusLabel(sale)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Total Amount</p>
                      <p className="font-bold text-sm text-[var(--text)] mt-0.5">{formatGhs(sale.total)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Payment</p>
                      <p className="font-semibold text-xs uppercase text-[var(--text)] mt-0.5 truncate">
                        {paymentLabel(sale)}
                      </p>
                    </div>
                    {isAdmin ? (
                      <div className="col-span-2 rounded-xl bg-white p-2.5 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Salesperson</p>
                        <p className="font-medium text-xs text-[var(--text)] mt-0.5">{sellerName(sale)}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3.5 border-t border-[var(--border)] pt-3">{saleActions(sale)}</div>
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
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] font-mono text-xs min-w-[120px]">
                        Receipt
                      </th>
                      <th className="px-4 py-3 font-medium">When</th>
                      {isAdmin ? <th className="px-4 py-3 font-medium">Salesperson</th> : null}
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sale) => (
                      <tr key={sale.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                        <td className="sticky left-0 bg-white z-10 whitespace-nowrap px-4 py-3 font-mono font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[120px]">
                          {sale.receiptNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">
                          {new Date(sale.createdAt).toLocaleString()}
                        </td>
                        {isAdmin ? <td className="whitespace-nowrap px-4 py-3">{sellerName(sale)}</td> : null}
                        <td className="whitespace-nowrap px-4 py-3 uppercase text-xs font-medium">{paymentLabel(sale)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatGhs(sale.total)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(
                              sale,
                            )}`}
                          >
                            {statusLabel(sale)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{saleActions(sale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            No sales found on this device yet.
          </p>
        )}
      </div>

      {/* Void Modal */}
      {voidingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold">Void sale</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              A reason is required to void this transaction. Batches and stock will be restored automatically.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
              rows={3}
              placeholder="e.g. Customer returned items, wrong amount billed..."
            />
            {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => handleVoid(voidingId)}
              >
                Confirm void
              </button>
              <button
                type="button"
                className="rounded-xl bg-canvas px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-slate-200"
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
