import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { listProducts } from '../api/inventory'
import { completeSale } from '../api/sales'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { formatGhs, toPesewas } from '../utils/money'

const MOMO_NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AT Money']

export default function PosPage() {
  const { isAdmin } = useAuth()
  const { online, refreshQueue, cacheCatalogue, getCachedCatalogue, catalogueAgeLabel } = useOffline()
  const navigate = useNavigate()
  const { search = '', setSearch } = useOutletContext() || {}
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [network, setNetwork] = useState(MOMO_NETWORKS[0])
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const rows = await listProducts()
      setProducts(rows)
      await cacheCatalogue(rows)
    } catch {
      const cached = await getCachedCatalogue()
      if (cached?.products) setProducts(cached.products)
    }
  }, [cacheCatalogue, getCachedCatalogue])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onSynced = () => {
      refresh()
    }
    window.addEventListener('sheco:synced', onSynced)
    return () => window.removeEventListener('sheco:synced', onSynced)
  }, [refresh])

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.genericName.toLowerCase().includes(q)
  })

  const total = cart.reduce((sum, line) => sum + line.sellingPrice * line.quantity, 0)
  const tenderedPesewas = toPesewas(amountTendered || 0)
  const change = paymentMethod === 'cash' ? Math.max(0, tenderedPesewas - total) : 0

  function addToCart(product) {
    setError('')
    if (product.availableQty <= 0) {
      setError('No sellable stock (expired batches excluded)')
      return
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        if (existing.quantity + 1 > product.availableQty) {
          setError(`Only ${product.availableQty} available for ${product.name}`)
          return prev
        }
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sellingPrice: product.sellingPrice,
          quantity: 1,
          availableQty: product.availableQty,
          prescriptionOnly: product.prescriptionOnly,
          prescriptionRef: '',
        },
      ]
    })
  }

  function updateQty(productId, quantity) {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.productId !== productId) return line
          const qty = Math.max(0, Number(quantity) || 0)
          if (qty > line.availableQty) {
            setError(`Only ${line.availableQty} available for ${line.name}`)
            return { ...line, quantity: line.availableQty }
          }
          return { ...line, quantity: qty }
        })
        .filter((line) => line.quantity > 0),
    )
  }

  async function checkout() {
    setError('')
    if (!cart.length) {
      setError('Add at least one product')
      return
    }
    for (const line of cart) {
      if (line.prescriptionOnly && !line.prescriptionRef.trim()) {
        setError(`Enter prescription reference for ${line.name}`)
        return
      }
      if (line.quantity > line.availableQty) {
        setError(`${line.name} exceeds available stock`)
        return
      }
    }
    if (paymentMethod === 'cash' && tenderedPesewas < total) {
      setError('Amount tendered is less than total')
      return
    }
    if (paymentMethod === 'momo' && !reference.trim()) {
      setError('Enter MoMo transaction reference')
      return
    }

    setBusy(true)
    try {
      const payload = {
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          prescriptionRef: line.prescriptionRef.trim() || null,
          sellingPrice: line.sellingPrice,
        })),
        payment: {
          method: paymentMethod,
          amountTendered: paymentMethod === 'cash' ? tenderedPesewas : total,
          change: paymentMethod === 'cash' ? change : 0,
          network: paymentMethod === 'momo' ? network : null,
          reference: paymentMethod === 'momo' ? reference.trim() : null,
        },
        offline: !online,
      }
      let sale
      try {
        sale = await completeSale(payload)
      } catch (err) {
        // If the server is unreachable, queue the sale locally.
        if (err?.status === 0 || /offline|reach the Sheco server/i.test(err?.message || '')) {
          sale = await completeSale({ ...payload, offline: true })
        } else {
          throw err
        }
      }
      await refreshQueue()
      setCart([])
      setAmountTendered('')
      setReference('')
      setSearch?.('')
      await refresh()
      navigate(`/sales/${sale.id}`, { state: { fresh: true, sale } })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{isAdmin ? 'Point of Sale' : 'New Sale'}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Search products, build a cart, take cash or Mobile Money.
          {!online
            ? ` Working offline — sale will queue for sync. Catalogue from ${catalogueAgeLabel}.`
            : ''}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow)]">
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-hospital hover:bg-hospital-light/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{product.genericName}</p>
                  </div>
                  {product.prescriptionOnly ? (
                    <span className="rounded-full bg-hospital-light px-2 py-0.5 text-[10px] font-semibold text-hospital-dark">
                      Rx
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-hospital-dark">{formatGhs(product.sellingPrice)}</span>
                  <span className={product.availableQty <= product.reorderLevel ? 'text-amber-600' : 'text-[var(--text-muted)]'}>
                    Qty {product.availableQty}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Cart</h3>
          {!cart.length ? (
            <p className="text-sm text-[var(--text-muted)]">No items yet.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((line) => (
                <div key={line.productId} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatGhs(line.sellingPrice)} each</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-500"
                      onClick={() => setCart((prev) => prev.filter((l) => l.productId !== line.productId))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateQty(line.productId, e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5"
                    />
                    <span className="text-sm font-semibold">
                      {formatGhs(line.sellingPrice * line.quantity)}
                    </span>
                  </div>
                  {line.prescriptionOnly ? (
                    <input
                      value={line.prescriptionRef}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((l) =>
                            l.productId === line.productId
                              ? { ...l, prescriptionRef: e.target.value }
                              : l,
                          ),
                        )
                      }
                      placeholder="Prescription reference / confirmation"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatGhs(total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {['cash', 'momo'].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  paymentMethod === method
                    ? 'bg-hospital text-white'
                    : 'bg-canvas text-[var(--text-muted)]'
                }`}
              >
                {method === 'cash' ? 'Cash' : 'Mobile Money'}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Amount tendered (GHS)</span>
              <input
                type="number"
                step="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Change: {formatGhs(change)}</p>
            </label>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Network</span>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
                >
                  {MOMO_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Transaction reference</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5"
                  placeholder="Confirmed on pharmacy MoMo line"
                />
              </label>
            </div>
          )}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="button"
            disabled={busy}
            onClick={checkout}
            className="w-full rounded-xl bg-hospital py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Processing...' : online ? 'Complete sale' : 'Complete offline sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
