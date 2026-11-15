import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LayoutGrid, List, PlusCircle, X } from 'lucide-react'
import { importProductsBulk, listProducts, saveProduct } from '../api/inventory'
import { useAuth } from '../context/AuthContext'
import { formatGhs, toPesewas, fromPesewas } from '../utils/money'
import { useOffline } from '../context/OfflineContext'
import { downloadProductCsvTemplate, parseProductCsv } from '../utils/productCsv'

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
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState('')
  const csvInputRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listProducts({ includeInactive: isAdmin })
      setProducts(rows)
      await cacheCatalogue(rows)
    } catch (err) {
      const cached = await getCachedCatalogue()
      if (cached?.products?.length) {
        setProducts(cached.products)
        setError('Showing saved products on this device (offline).')
      } else {
        setProducts([])
        setError(err.message || 'No saved products on this device yet. Open Products once while online.')
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
    setImportSummary('')
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
    setIsFormOpen(true)
  }

  function openAddProduct() {
    setError('')
    setMessage('')
    setImportSummary('')
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setImportSummary('')

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
      const isEdit = Boolean(form.id)
      setForm(emptyForm)
      setIsFormOpen(false)
      setMessage(isEdit ? 'Product updated successfully' : 'Product created successfully')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCsvImport(file) {
    if (!file) return
    setError('')
    setMessage('')
    setImportSummary('')
    setImporting(true)

    try {
      const text = await file.text()
      const { rows, errors } = parseProductCsv(text)
      if (errors.length) {
        throw new Error(errors.join('; '))
      }
      if (!rows.length) {
        throw new Error('CSV file contains no valid product rows')
      }

      const result = await importProductsBulk(rows)
      setImportSummary(
        `Import complete: ${result.created} created, ${result.updated} updated${
          result.errors?.length ? `, ${result.errors.length} failed` : ''
        }`,
      )
      await refresh()
    } catch (err) {
      setError(err.message || 'Failed to import CSV')
    } finally {
      setImporting(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Products</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage catalogue, cost and selling prices, reorder levels, and Rx flags.
          </p>
        </div>

        {/* Top Controls: Mobile View Switcher & Add Product Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
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

          {/* Add Product Button (Accessible right at the top on all devices) */}
          {isAdmin ? (
            <button
              type="button"
              onClick={openAddProduct}
              className="inline-flex items-center gap-1.5 rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-hospital-dark"
            >
              <PlusCircle size={16} /> Add Product
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.3fr_0.7fr] min-w-0">
        {/* Products Catalogue Table / Cards Container */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
          {loading ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">Loading products...</p>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
                {filtered.map((product) => (
                  <article
                    key={product.id}
                    className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text)]">{product.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{product.genericName}</p>
                        <p className="mt-1 text-xs font-medium text-hospital-dark">
                          {product.category}
                        </p>
                      </div>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg bg-hospital-light px-3 py-1.5 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      {isAdmin ? (
                        <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                            Cost Price
                          </p>
                          <p className="font-medium text-xs mt-0.5">{formatGhs(product.costPrice || 0)}</p>
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                          Selling Price
                        </p>
                        <p className="font-semibold text-xs mt-0.5">{formatGhs(product.sellingPrice)}</p>
                      </div>
                      {isAdmin ? (
                        <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                            Profit / unit
                          </p>
                          <p className="font-semibold text-xs text-emerald-700 mt-0.5">
                            {formatGhs(product.unitProfit || 0)}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-white p-2.5 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                          Stock
                        </p>
                        <p className={`text-xs mt-0.5 ${product.lowStock ? 'font-bold text-amber-600' : 'font-medium'}`}>
                          {product.availableQty}
                          <span className="font-normal text-[var(--text-muted)]"> / {product.unit}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {product.prescriptionOnly ? (
                        <span className="rounded-full bg-hospital-light px-2 py-0.5 text-[10px] font-semibold text-hospital-dark">
                          Rx
                        </span>
                      ) : null}
                      {product.lowStock ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Low stock
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
                  </article>
                ))}
                {!filtered.length ? (
                  <p className="px-1 py-4 text-sm text-[var(--text-muted)]">No products found.</p>
                ) : null}
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
                        <th className="px-4 py-3 font-medium">Category</th>
                        {isAdmin ? <th className="px-4 py-3 font-medium">Cost</th> : null}
                        <th className="px-4 py-3 font-medium">Selling</th>
                        {isAdmin ? <th className="px-4 py-3 font-medium">Profit / unit</th> : null}
                        <th className="px-4 py-3 font-medium">Stock</th>
                        <th className="px-4 py-3 font-medium">Flags</th>
                        <th className="px-4 py-3 font-medium text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((product) => (
                        <tr key={product.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                          <td className="sticky left-0 bg-white z-10 px-4 py-3 shadow-[1px_0_0_0_#e5e7eb] min-w-[150px]">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">{product.genericName}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">{product.category}</td>
                          {isAdmin ? (
                            <td className="whitespace-nowrap px-4 py-3">{formatGhs(product.costPrice || 0)}</td>
                          ) : null}
                          <td className="whitespace-nowrap px-4 py-3">{formatGhs(product.sellingPrice)}</td>
                          {isAdmin ? (
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                              {formatGhs(product.unitProfit || 0)}
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={product.lowStock ? 'font-semibold text-amber-600' : ''}>
                              {product.availableQty}
                            </span>
                            <span className="text-[var(--text-muted)]"> / {product.unit}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
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
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {isAdmin ? (
                              <button
                                type="button"
                                className="rounded-lg bg-hospital-light px-2.5 py-1 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
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
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop Sidebar: Bulk CSV Import & Form (shown on desktop screens) */}
        {isAdmin ? (
          <div className="hidden xl:block space-y-4">
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-[var(--shadow)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Bulk CSV import</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Upload a CSV to add many products at once. Prices are in GHS.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-hospital-dark transition hover:bg-slate-50"
                  onClick={downloadProductCsvTemplate}
                >
                  Download template
                </button>
              </div>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-hospital-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-hospital-dark"
                disabled={importing}
                onChange={(e) => handleCsvImport(e.target.files?.[0])}
              />

              <p className="text-xs text-[var(--text-muted)]">
                Columns: name, genericName, category, unit, costPrice, sellingPrice,
                reorderLevel, prescriptionOnly, active
              </p>

              {importing ? (
                <p className="text-sm text-[var(--text-muted)]">Importing products...</p>
              ) : null}
              {importSummary ? (
                <p className="text-sm text-hospital-dark">{importSummary}</p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
              <h3 className="text-lg font-semibold mb-3">{form.id ? 'Edit product' : 'Add product'}</h3>
              <ProductFormFields
                form={form}
                setForm={setForm}
                handleSubmit={handleSubmit}
                unitProfit={unitProfit}
                error={error}
                onCancel={form.id ? () => setForm(emptyForm) : null}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile & Tablet Modal / Bottom-Sheet: Add or Edit Product */}
      {isAdmin && isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <h3 className="text-lg font-semibold">{form.id ? 'Edit Product' : 'Add New Product'}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {form.id
                    ? 'Update prices, catalogue flags, or stock reorder levels'
                    : 'Add a new medication or product to the pharmacy catalogue'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false)
                  setForm(emptyForm)
                  setError('')
                }}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-canvas transition"
              >
                <X size={20} />
              </button>
            </div>

            <ProductFormFields
              form={form}
              setForm={setForm}
              handleSubmit={handleSubmit}
              unitProfit={unitProfit}
              error={error}
              onCancel={() => {
                setIsFormOpen(false)
                setForm(emptyForm)
                setError('')
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProductFormFields({ form, setForm, handleSubmit, unitProfit, error, onCancel }) {
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {[
        ['name', 'Name', 'e.g. Amlodipine 5mg'],
        ['genericName', 'Generic name', 'e.g. Amlodipine'],
        ['category', 'Category', 'e.g. Hypertension, Antibiotic'],
      ].map(([key, label, placeholder]) => (
        <label key={key} className="block text-sm">
          <span className="mb-1 block font-medium">{label}</span>
          <input
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
            required
            placeholder={placeholder}
          />
        </label>
      ))}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Unit</span>
        <select
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cost price (GHS)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.costPrice}
            onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
            required
            placeholder="0.00"
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
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
            required
            placeholder="0.00"
          />
        </label>
      </div>

      {unitProfit != null ? (
        <div className="rounded-xl bg-hospital-light px-3.5 py-2 text-xs text-hospital-dark flex items-center justify-between">
          <span>Estimated profit / unit:</span>
          <span className="font-bold text-sm text-emerald-700">{formatGhs(unitProfit)}</span>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Reorder level threshold</span>
        <input
          type="number"
          min="0"
          value={form.reorderLevel}
          onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
          className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
          required
        />
      </label>

      <div className="flex flex-wrap gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={form.prescriptionOnly}
            onChange={(e) => setForm({ ...form, prescriptionOnly: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-hospital focus:ring-hospital"
          />
          Prescription only (Rx)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-hospital focus:ring-hospital"
          />
          Active in catalogue
        </label>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark"
        >
          {form.id ? 'Save changes' : 'Create product'}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="rounded-xl bg-canvas px-4 py-3 font-semibold text-[var(--text)] transition hover:bg-slate-200"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
