import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Search, X } from 'lucide-react'
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
  const productSearchRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await listProducts()
      setProducts(rows)
      await cacheCatalogue(rows)
      setError('')
    } catch {
      const cached = await getCachedCatalogue()
      if (cached?.products?.length) {
        setProducts(cached.products)
        setError('')
      } else {
        setProducts([])
        setError('No saved catalogue on this device. Sign in online once and open POS to cache products.')
      }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const name = String(p.name || '').toLowerCase()
      const generic = String(p.genericName || '').toLowerCase()
      const category = String(p.category || '').toLowerCase()
      return name.includes(q) || generic.includes(q) || category.includes(q)
    })
  }, [products, search])

  useEffect(() => {
    // Keep the product finder ready on POS open (desktop + tablet).
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      productSearchRef.current?.focus()
    }
  }, [])

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
          Search a product, tap to add it to the cart, then take cash or Mobile Money.
          {!online
            ? ` Working offline — sale will queue for sync. Catalogue from ${catalogueAgeLabel}.`
            : ''}
        </p>
      </div>

      <div className="sticky top-[4.25rem] z-20 -mx-1 space-y-2 rounded-2xl bg-canvas/95 px-1 py-2 backdrop-blur-md md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-hospital-dark"
          />
          <input
            ref={productSearchRef}
            value={search}
            onChange={(e) => setSearch?.(e.target.value)}
            placeholder="Search product name, generic, or category..."
            className="w-full rounded-2xl border border-hospital-soft bg-white py-3.5 pl-11 pr-11 text-sm font-medium shadow-[var(--shadow)] outline-none transition focus:border-hospital focus:ring-2 focus:ring-hospital/20"
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Search products for sale"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch?.('')
                productSearchRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-hospital-light text-hospital-dark"
              aria-label="Clear product search"
            >
              <X size={16} />
            </button>
          ) : null}
        </label>
        <p className="px-1 text-xs text-[var(--text-muted)]">
          {search.trim()
            ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} · tap a product to add to cart`
            : `${products.length} products available · start typing to find one fast`}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr] xl:gap-6">
        <div className="order-2 rounded-2xl bg-white p-3 shadow-[var(--shadow)] sm:p-4 xl:order-1">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  addToCart(product)
                  // Keep typing flow fast for the next item.
                  productSearchRef.current?.focus()
                }}
                className="rounded-2xl border border-[var(--border)] p-3.5 text-left transition active:scale-[0.99] hover:border-hospital hover:bg-hospital-light/40 sm:p-4"
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
          {!filtered.length ? (
            <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-sm text-[var(--text-muted)]">
              No products match “{search.trim()}”. Try another name or clear the search.
            </p>
          ) : null}
        </div>

        <div className="order-1 space-y-4 rounded-2xl bg-white p-4 shadow-[var(--shadow)] sm:p-5 xl:order-2 xl:sticky xl:top-24 xl:self-start">
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
            className="w-full rounded-2xl bg-hospital py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(46,123,168,0.28)] disabled:opacity-60"
          >
            {busy ? 'Processing...' : online ? 'Complete sale' : 'Complete offline sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
