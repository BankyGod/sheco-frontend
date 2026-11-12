import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Needs review</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Offline syncs that oversold stock, hit price changes, or need MoMo confirmation.
        </p>
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved review flags on this device. Clearing reviews needs an online session.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Receipt</th>
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
              <tr key={sale.id} className="border-t border-[var(--border)] align-top">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/sales/${sale.id}`} className="text-hospital-dark hover:underline">
                    {sale.receiptNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{sale.salespersonName || sale.salespersonId}</td>
                <td className="px-4 py-3 uppercase">
                  {sale.payment?.method}
                  {sale.payment?.network ? ` · ${sale.payment.network}` : ''}
                  {sale.payment?.reference ? (
                    <div className="text-xs text-[var(--text-muted)]">{sale.payment.reference}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{formatGhs(sale.total)}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {sale.reviewReason || 'Flagged for review'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/inventory`}
                      className="rounded-lg bg-hospital-light px-2 py-1 text-xs font-semibold text-hospital-dark"
                    >
                      Check stock
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === sale.id}
                      onClick={() => handleClear(sale)}
                      className="rounded-lg bg-canvas px-2 py-1 text-xs font-semibold disabled:opacity-60"
                    >
                      {busyId === sale.id ? 'Clearing...' : 'Mark reviewed'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !sales.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[var(--text-muted)]">
                  No sales need review.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
