import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { listSales, voidSale } from '../api/sales'
import { listUsers } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { formatGhs } from '../utils/money'

export default function SalesPage() {
  const { user, isAdmin, actor } = useAuth()
  const { search = '' } = useOutletContext() || {}
  const [tick, setTick] = useState(0)
  const sales = useMemo(() => listSales({ user }), [tick, user])
  const users = useMemo(() => listUsers(), [])
  const [voidingId, setVoidingId] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const filtered = sales.filter((sale) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return sale.receiptNumber.toLowerCase().includes(q) || sale.payment.method.includes(q)
  })

  function handleVoid(saleId) {
    setError('')
    try {
      voidSale(saleId, reason, actor())
      setVoidingId(null)
      setReason('')
      setTick((t) => t + 1)
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

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
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
              const seller = users.find((u) => u.id === sale.salespersonId)
              return (
                <tr key={sale.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{sale.receiptNumber}</td>
                  <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                  {isAdmin ? <td className="px-4 py-3">{seller?.name || sale.salespersonId}</td> : null}
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
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/sales/${sale.id}`} className="text-xs font-semibold text-hospital-dark">
                        Receipt
                      </Link>
                      {isAdmin && sale.status === 'completed' ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-500"
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
