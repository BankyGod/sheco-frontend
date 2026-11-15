import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, LayoutGrid, List, AlertTriangle, ExternalLink } from 'lucide-react'
import { clearSaleReview, listSalesNeedingReview } from '../api/sales'
import { formatGhs } from '../utils/money'
import { getCachedSales } from '../utils/offlineStore'

export default function NeedsReviewPage() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setSales(await listSalesNeedingReview())
      setFromCache(false)
      setError('')
    } catch (err) {
      const cached = await getCachedSales()
      const rows = (cached?.sales || []).filter((sale) => sale.needsReview)
      if (rows.length || cached?.sales) {
        setSales(rows)
        setFromCache(true)
        setError('')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleClear(sale) {
    const note = window.prompt(
      `Clear review for ${sale.receiptNumber}? Optional note:`,
      'Stock/MoMo checked',
    )
    if (note === null) return
    setBusyId(sale.id)
    setError('')
    setMessage('')
    try {
      await clearSaleReview(sale.id, note)
      setMessage(`Cleared review for ${sale.receiptNumber}`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and View Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Needs review</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Offline syncs that oversold stock, hit price changes, or need MoMo confirmation.
          </p>
        </div>

        {sales.length ? (
          <div className="flex items-center gap-1 rounded-xl bg-canvas p-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobileViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                mobileViewMode === 'cards'
                  ? 'bg-white text-hospital-dark shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                mobileViewMode === 'table'
                  ? 'bg-white text-hospital-dark shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <List size={14} /> Table
            </button>
          </div>
        ) : null}
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved review flags on this device. Clearing reviews needs an online session.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="font-semibold text-[var(--text)]">Review Queue</span>
          <span className="text-xs text-[var(--text-muted)]">{sales.length} items</span>
        </div>

        {!loading && !sales.length ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={26} />
            </div>
            <p className="font-semibold text-[var(--text)]">No sales need review</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              All offline transactions synced cleanly. Any oversold stock or MoMo mismatches will appear here.
            </p>
          </div>
        ) : null}

        {sales.length ? (
          <>
            {/* Mobile Card Layout */}
            <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
              {sales.map((sale) => (
                <article
                  key={sale.id}
                  className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/sales/${sale.id}`}
                        className="inline-flex items-center gap-1 font-mono text-sm font-bold text-hospital-dark hover:underline"
                      >
                        {sale.receiptNumber} <ExternalLink size={12} />
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {new Date(sale.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-[var(--text)] border border-[var(--border)]">
                      {formatGhs(sale.total)}
                    </span>
                  </div>

                  <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                    <p className="font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-700">
                      <AlertTriangle size={13} /> Reason for Review
                    </p>
                    <p className="mt-1 font-medium">{sale.reviewReason || 'Flagged for review'}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Payment</p>
                      <p className="font-semibold text-xs uppercase text-[var(--text)] mt-0.5 truncate">
                        {sale.payment?.method || 'Cash'}
                        {sale.payment?.network ? ` · ${sale.payment.network}` : ''}
                      </p>
                      {sale.payment?.reference ? (
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{sale.payment.reference}</p>
                      ) : null}
                    </div>

                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Salesperson</p>
                      <p className="font-medium text-xs text-[var(--text)] mt-0.5 truncate">
                        {sale.salespersonName || sale.salespersonId || 'Staff'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    <Link
                      to="/inventory"
                      className="flex-1 text-center rounded-xl bg-hospital-light py-2 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
                    >
                      Check stock
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === sale.id}
                      onClick={() => handleClear(sale)}
                      className="flex-1 rounded-xl bg-canvas py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-slate-200 disabled:opacity-60"
                    >
                      {busyId === sale.id ? 'Clearing...' : 'Mark reviewed'}
                    </button>
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
              <div className="table-scroll w-full max-w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 bg-canvas px-4 py-3 font-medium z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        Receipt
                      </th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Salesperson</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-t border-[var(--border)] align-top hover:bg-canvas/40 transition">
                        <td className="sticky left-0 bg-white px-4 py-3 font-medium z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          <Link to={`/sales/${sale.id}`} className="font-mono text-hospital-dark hover:underline">
                            {sale.receiptNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--text-muted)]">
                          {new Date(sale.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{sale.salespersonName || sale.salespersonId}</td>
                        <td className="px-4 py-3 uppercase text-xs">
                          {sale.payment?.method}
                          {sale.payment?.network ? ` · ${sale.payment.network}` : ''}
                          {sale.payment?.reference ? (
                            <div className="text-[11px] text-[var(--text-muted)]">{sale.payment.reference}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-bold">{formatGhs(sale.total)}</td>
                        <td className="px-4 py-3 text-xs text-amber-800">
                          <span className="inline-block rounded-lg bg-amber-50 px-2 py-1 border border-amber-200">
                            {sale.reviewReason || 'Flagged for review'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to="/inventory"
                              className="rounded-lg bg-hospital-light px-2.5 py-1 text-xs font-semibold text-hospital-dark hover:bg-hospital hover:text-white transition"
                            >
                              Check stock
                            </Link>
                            <button
                              type="button"
                              disabled={busyId === sale.id}
                              onClick={() => handleClear(sale)}
                              className="rounded-lg bg-canvas px-2.5 py-1 text-xs font-semibold text-[var(--text)] hover:bg-slate-200 transition disabled:opacity-60"
                            >
                              {busyId === sale.id ? 'Clearing...' : 'Mark reviewed'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
