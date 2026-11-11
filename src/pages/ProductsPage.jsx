import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listProducts, saveProduct } from '../api/inventory'
import { useAuth } from '../context/AuthContext'
import { formatGhs, toPesewas, fromPesewas } from '../utils/money'
import { useOffline } from '../context/OfflineContext'

const UNIT_OPTIONS = [
  'tablet',
  'capsule',
  'blister',
  'bottle',
  'sachet',
  'syrup',
  'ml',
  'box',
  'tube',
  'vial',
  'ampoule',
  'pack',
]

const emptyForm = {
  id: null,
  name: '',
  genericName: '',
  category: '',
  unit: 'tablet',
  costPrice: '',
  sellingPrice: '',
  reorderLevel: 10,
  prescriptionOnly: false,
  active: true,
}

export default function ProductsPage() {
  const { isAdmin } = useAuth()
  const { cacheCatalogue, getCachedCatalogue } = useOffline()
  const { search = '' } = useOutletContext() || {}
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listProducts({ includeInactive: isAdmin })
      setProducts(rows)
      await cacheCatalogue(rows)
    } catch (err) {
      const cached = await getCachedCatalogue()
      if (cached?.products) {
        setProducts(cached.products)
        setError('Showing cached catalogue (API unavailable)')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [isAdmin, cacheCatalogue, getCachedCatalogue])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.genericName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  })

  const costPesewas = form.costPrice === '' ? null : toPesewas(form.costPrice)
  const sellingPesewas = form.sellingPrice === '' ? null : toPesewas(form.sellingPrice)
  const unitProfit =
    costPesewas != null && sellingPesewas != null ? sellingPesewas - costPesewas : null

  function editProduct(product) {
    setError('')
    setMessage('')
    setForm({
      id: product.id,
      name: product.name,
      genericName: product.genericName,
      category: product.category,
      unit: product.unit,
      costPrice: String(fromPesewas(product.costPrice || 0)),
      sellingPrice: String(fromPesewas(product.sellingPrice)),
      reorderLevel: product.reorderLevel,
      prescriptionOnly: product.prescriptionOnly,
      active: product.active,
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    const cost = toPesewas(form.costPrice)
    const selling = toPesewas(form.sellingPrice)

    if (Number.isNaN(cost) || cost < 0) {
      setError('Enter a valid cost price')
      return
    }
    if (Number.isNaN(selling) || selling <= 0) {
      setError('Enter a valid selling price')
      return
    }
    if (selling < cost) {
      setError('Selling price should be at least the cost price')
      return
    }

    try {
      await saveProduct({
        id: form.id || undefined,
        name: form.name,
        genericName: form.genericName,
        category: form.category,
        unit: form.unit,
        costPrice: cost,
        sellingPrice: selling,
        reorderLevel: Number(form.reorderLevel),
        prescriptionOnly: Boolean(form.prescriptionOnly),
        active: Boolean(form.active),
      })
      setForm(emptyForm)
      setMessage(form.id ? 'Product updated' : 'Product created')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Products</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage catalogue, cost and selling prices, reorder levels, and Rx flags.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
          {loading ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">Loading products...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  {isAdmin ? <th className="px-4 py-3 font-medium">Cost</th> : null}
                  <th className="px-4 py-3 font-medium">Selling</th>
                  {isAdmin ? <th className="px-4 py-3 font-medium">Profit / unit</th> : null}
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{product.genericName}</p>
                    </td>
                    <td className="px-4 py-3">{product.category}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3">{formatGhs(product.costPrice || 0)}</td>
                    ) : null}
                    <td className="px-4 py-3">{formatGhs(product.sellingPrice)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3 font-medium text-emerald-700">
                        {formatGhs(product.unitProfit || 0)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <span className={product.lowStock ? 'font-semibold text-amber-600' : ''}>
                        {product.availableQty}
                      </span>
                      <span className="text-[var(--text-muted)]"> / {product.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {product.prescriptionOnly ? (
                          <span className="rounded-full bg-hospital-light px-2 py-0.5 text-[10px] font-semibold text-hospital-dark">
                            Rx
                          </span>
                        ) : null}
                        {product.lowStock ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Low
                          </span>
                        ) : null}
                        {product.expiringSoon ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            Expiring
                          </span>
                        ) : null}
                        {!product.active ? (
                          <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-hospital-dark"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isAdmin ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
            <h3 className="text-lg font-semibold">{form.id ? 'Edit product' : 'Add product'}</h3>
            {[
              ['name', 'Name'],
              ['genericName', 'Generic name'],
              ['category', 'Category'],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-medium">{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                  required
                />
              </label>
            ))}

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Unit</span>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                required
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
                {form.unit && !UNIT_OPTIONS.includes(form.unit) ? (
                  <option value={form.unit}>{form.unit}</option>
                ) : null}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Cost price (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Selling price (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                  required
                />
              </label>
            </div>

            {unitProfit != null ? (
              <div className="rounded-xl bg-hospital-light px-3 py-2.5 text-sm text-hospital-dark">
                Estimated profit / unit:{' '}
                <span className="font-semibold">{formatGhs(unitProfit)}</span>
              </div>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Reorder level</span>
              <input
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.prescriptionOnly}
                onChange={(e) => setForm({ ...form, prescriptionOnly: e.target.checked })}
              />
              Prescription only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-hospital py-3 font-semibold text-white">
                Save
              </button>
              {form.id ? (
                <button
                  type="button"
                  className="rounded-xl bg-canvas px-4 py-3 font-semibold"
                  onClick={() => {
                    setForm(emptyForm)
                    setError('')
                    setMessage('')
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
