import { useCallback, useEffect, useState } from 'react'
import { Boxes, LayoutGrid, List, RefreshCw } from 'lucide-react'
import { adjustStock, getStockAlerts, listProducts, restock } from '../api/inventory'
import { formatGhs, fromPesewas } from '../utils/money'
import { getCachedAlerts, getCachedCatalogue } from '../utils/offlineStore'

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [] })
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'
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
    setError('')
    try {
      const [productRows, alertRows] = await Promise.all([
        listProducts({ includeInactive: false }),
        getStockAlerts(),
      ])
      setProducts(productRows)
      setAlerts(alertRows)
      setFromCache(false)
    } catch (err) {
      const [cachedProducts, cachedAlerts] = await Promise.all([
        getCachedCatalogue(),
        getCachedAlerts(),
      ])
      if (cachedProducts?.products?.length || cachedAlerts?.alerts) {
        setProducts(cachedProducts?.products || [])
        setAlerts(cachedAlerts?.alerts || { lowStock: [], expiringSoon: [], expired: [] })
        setFromCache(true)
        setError('')
      } else {
        setError(err.message || 'No saved inventory on this device yet.')
      }
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
      setMessage('Restock recorded successfully')
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
      setMessage('Stock adjusted successfully')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved inventory on this device. Restock and adjustments require an online session.
        </p>
      ) : null}

      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Inventory & Batches</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            FEFO batch tracking, remaining quantities, restock entry, and stock adjustments.
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

      {/* Stock Health Badges */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <AlertCard title="Low stock" count={alerts.lowStock?.length || 0} tone="amber" />
        <AlertCard title="Expiring ≤ 90d" count={alerts.expiringSoon?.length || 0} tone="red" />
        <AlertCard title="Expired" count={alerts.expired?.length || 0} tone="slate" />
      </div>

      {/* Product / Batch Inventory Table Container */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="font-semibold text-[var(--text)]">Stock & Batches</span>
          <span className="text-xs text-[var(--text-muted)]">{allBatches.length} active batches</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Loading inventory...</p>
        ) : allBatches.length ? (
          <>
            {/* Mobile Card Layout */}
            <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
              {allBatches.map((batch) => (
                <article
                  key={batch.id}
                  className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base text-[var(--text)]">{batch.productName}</p>
                      <p className="mt-0.5 text-xs font-mono text-[var(--text-muted)]">
                        Batch #{batch.batchNumber}
                      </p>
                    </div>
                    <BatchStatus batch={batch} compact />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                        Expiry Date
                      </p>
                      <p className="font-medium text-xs mt-0.5">{batch.expiryDate || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                        Remaining Stock
                      </p>
                      <p className="font-bold text-sm text-[var(--text)] mt-0.5">{batch.quantityRemaining}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                        Cost Price
                      </p>
                      <p className="font-medium text-xs mt-0.5">{formatGhs(batch.costPrice)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                        Supplier
                      </p>
                      <p className="font-medium text-xs mt-0.5 truncate">{batch.supplier || '—'}</p>
                    </div>
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
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[150px]">
                        Product
                      </th>
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
                      <tr key={batch.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                        <td className="sticky left-0 bg-white z-10 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[150px]">
                          {batch.productName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{batch.batchNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3">{batch.expiryDate}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{batch.quantityRemaining}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatGhs(batch.costPrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{batch.supplier || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <BatchStatus batch={batch} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            No batches found. Record a restock below to add inventory.
          </p>
        )}
      </div>

      {/* Restock & Adjustment Forms */}
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleRestock} className="space-y-3.5 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center gap-2">
            <Boxes className="text-hospital" size={20} />
            <h3 className="text-lg font-semibold">Record Restock</h3>
          </div>
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
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
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
            ['quantity', 'Quantity to restock'],
            ['costPrice', 'Cost price (GHS)'],
            ['supplier', 'Supplier name'],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                type={
                  key === 'expiryDate'
                    ? 'date'
                    : key === 'quantity' || key === 'costPrice'
                      ? 'number'
                      : 'text'
                }
                value={restockForm[key]}
                onChange={(e) => setRestockForm({ ...restockForm, [key]: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
                required
                step={key === 'costPrice' ? '0.01' : undefined}
                placeholder={key === 'supplier' ? 'e.g. Ernest Chemist, Tobinco...' : ''}
              />
            </label>
          ))}
          <button
            type="submit"
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark"
          >
            Save restock
          </button>
        </form>

        <form onSubmit={handleAdjust} className="space-y-3.5 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-hospital" size={18} />
            <h3 className="text-lg font-semibold">Stock Adjustment</h3>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Batch</span>
            <select
              value={adjustForm.batchId}
              onChange={(e) => setAdjustForm({ ...adjustForm, batchId: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
              required
            >
              <option value="">Select batch</option>
              {allBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.productName} · Batch {b.batchNumber} ({b.quantityRemaining} left)
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
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Reason for adjustment</span>
            <textarea
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
              required
              rows={3}
              placeholder="e.g. Expired batch discarded, inventory audit correction, breakage..."
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark"
          >
            Apply adjustment
          </button>
        </form>
      </div>
    </div>
  )
}

function BatchStatus({ batch, compact = false }) {
  const size = compact ? 'text-[10px]' : 'text-xs'
  if (batch.expired) {
    return (
      <span className={`rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 ${size}`}>
        Expired
      </span>
    )
  }
  if (batch.daysToExpiry <= 90) {
    return (
      <span className={`rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ${size}`}>
        {batch.daysToExpiry}d left
      </span>
    )
  }
  return (
    <span className={`rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ${size}`}>
      OK
    </span>
  )
}

function AlertCard({ title, count, tone }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <div className={`rounded-2xl p-3.5 sm:p-5 ${tones[tone]}`}>
      <p className="text-xs sm:text-sm font-medium">{title}</p>
      <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold">{count}</p>
    </div>
  )
}
