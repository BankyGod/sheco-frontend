import { useCallback, useEffect, useState } from 'react'
import { adjustStock, getStockAlerts, listProducts, restock } from '../api/inventory'
import { formatGhs, fromPesewas } from '../utils/money'

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [] })
  const [loading, setLoading] = useState(true)
  const [restockForm, setRestockForm] = useState({
    productId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    costPrice: '',
    supplier: '',
  })
  const [adjustForm, setAdjustForm] = useState({
    batchId: '',
    newQuantity: '',
    reason: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [productRows, alertRows] = await Promise.all([
        listProducts({ includeInactive: false }),
        getStockAlerts(),
      ])
      setProducts(productRows)
      setAlerts(alertRows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const allBatches = products.flatMap((p) =>
    (p.batches || []).map((b) => ({ ...b, productName: p.name })),
  )

  async function handleRestock(e) {
    e.preventDefault()
    setError('')
    try {
      await restock({
        ...restockForm,
        costPrice: Math.round(Number(restockForm.costPrice) * 100),
      })
      setRestockForm({
        productId: '',
        batchNumber: '',
        expiryDate: '',
        quantity: '',
        costPrice: '',
        supplier: '',
      })
      setMessage('Restock recorded')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdjust(e) {
    e.preventDefault()
    setError('')
    try {
      await adjustStock(adjustForm)
      setAdjustForm({ batchId: '', newQuantity: '', reason: '' })
      setMessage('Stock adjusted')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Inventory</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Batches, restocking, FEFO sellable stock, and adjustments with reasons.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AlertCard title="Low stock" count={alerts.lowStock?.length || 0} tone="amber" />
        <AlertCard title="Expiring ≤ 90 days" count={alerts.expiringSoon?.length || 0} tone="red" />
        <AlertCard title="Expired batches" count={alerts.expired?.length || 0} tone="slate" />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Loading inventory...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allBatches.map((batch) => (
                <tr key={batch.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{batch.productName}</td>
                  <td className="px-4 py-3">{batch.batchNumber}</td>
                  <td className="px-4 py-3">{batch.expiryDate}</td>
                  <td className="px-4 py-3">{batch.quantityRemaining}</td>
                  <td className="px-4 py-3">{formatGhs(batch.costPrice)}</td>
                  <td className="px-4 py-3">{batch.supplier}</td>
                  <td className="px-4 py-3">
                    {batch.expired ? (
                      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                        Expired
                      </span>
                    ) : batch.daysToExpiry <= 90 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        {batch.daysToExpiry}d left
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleRestock} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Record restock</h3>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Product</span>
            <select
              value={restockForm.productId}
              onChange={(e) => {
                const productId = e.target.value
                const product = products.find((p) => p.id === productId)
                setRestockForm({
                  ...restockForm,
                  productId,
                  costPrice:
                    product?.costPrice != null
                      ? String(fromPesewas(product.costPrice))
                      : restockForm.costPrice,
                })
              }}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              required
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {[
            ['batchNumber', 'Batch number'],
            ['expiryDate', 'Expiry date'],
            ['quantity', 'Quantity'],
            ['costPrice', 'Cost price (GHS)'],
            ['supplier', 'Supplier'],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                type={key === 'expiryDate' ? 'date' : key === 'quantity' || key === 'costPrice' ? 'number' : 'text'}
                value={restockForm[key]}
                onChange={(e) => setRestockForm({ ...restockForm, [key]: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
                required
                step={key === 'costPrice' ? '0.01' : undefined}
              />
            </label>
          ))}
          <button type="submit" className="w-full rounded-xl bg-hospital py-3 font-semibold text-white">
            Save restock
          </button>
        </form>

        <form onSubmit={handleAdjust} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Stock adjustment</h3>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Batch</span>
            <select
              value={adjustForm.batchId}
              onChange={(e) => setAdjustForm({ ...adjustForm, batchId: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              required
            >
              <option value="">Select batch</option>
              {allBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.productName} · {b.batchNumber} ({b.quantityRemaining})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New quantity remaining</span>
            <input
              type="number"
              value={adjustForm.newQuantity}
              onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Reason</span>
            <textarea
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              required
              rows={3}
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button type="submit" className="w-full rounded-xl bg-hospital py-3 font-semibold text-white">
            Apply adjustment
          </button>
        </form>
      </div>
    </div>
  )
}

function AlertCard({ title, count, tone }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <div className={`rounded-2xl p-5 ${tones[tone]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{count}</p>
    </div>
  )
}
