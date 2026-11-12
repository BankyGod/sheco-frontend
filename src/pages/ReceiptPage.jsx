import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getSale, getQueuedSales } from '../api/sales'
import { formatGhs } from '../utils/money'
import { listProducts } from '../api/inventory'
import { getCachedCatalogue } from '../utils/offlineStore'

export default function ReceiptPage() {
  const { id } = useParams()
  const location = useLocation()
  const [sale, setSale] = useState(location.state?.sale || null)
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!location.state?.sale)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let productRows = []
        try {
          productRows = await listProducts({ includeInactive: true })
        } catch {
          productRows = (await getCachedCatalogue())?.products || []
        }
        if (!active) return
        setProducts(productRows)

        if (location.state?.sale) {
          setSale(location.state.sale)
          return
        }

        const queuedRows = await getQueuedSales()
        const queued = queuedRows.find((s) => s.id === id)
        if (queued) {
          setSale(queued)
          return
        }

        const remoteSale = await getSale(id)
        if (!active) return
        setSale(remoteSale)
      } catch (err) {
        if (active && !location.state?.sale) setError(err.message || 'Receipt not found')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [id, location.state?.sale])

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading receipt...</p>
  }

  if (error || !sale) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-base">{error || 'Receipt not found.'}</p>
        <Link to="/sales" className="mt-3 inline-block text-hospital-dark">
          Back to sales
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 print:max-w-none print:space-y-0">
      {location.state?.fresh ? (
        <p className="no-print rounded-xl bg-emerald-50 px-5 py-3.5 text-base font-medium text-emerald-700">
          Sale completed successfully.
        </p>
      ) : null}

      <div
        id="printable-receipt"
        className="rounded-3xl bg-white p-8 shadow-[var(--shadow)] md:p-10 print:p-0 print:shadow-none"
      >
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight">
            Sheco<span className="text-hospital">.</span>
          </h2>
          <p className="mt-2 text-base text-[var(--text-muted)]">Pharmacy receipt</p>
        </div>

        <div className="mt-8 grid gap-3 rounded-2xl bg-canvas p-5 text-base sm:grid-cols-2 print:bg-transparent print:p-0">
          <Meta label="Receipt" value={sale.receiptNumber} />
          <Meta label="Device" value={sale.deviceId} />
          <Meta label="Date" value={new Date(sale.createdAt).toLocaleString()} />
          <Meta label="Status" value={sale.status} />
          {sale.voidReason ? <Meta label="Void reason" value={sale.voidReason} /> : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="grid grid-cols-[1.6fr_0.6fr_0.7fr_0.8fr] gap-3 bg-canvas px-5 py-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Amount</span>
          </div>
          {sale.items.map((item, idx) => {
            const product = products.find((p) => p.id === item.productId)
            return (
              <div
                key={`${item.batchId}-${idx}`}
                className="grid grid-cols-[1.6fr_0.6fr_0.7fr_0.8fr] gap-3 border-t border-[var(--border)] px-5 py-4 text-base"
              >
                <div>
                  <p className="font-semibold">{product?.name || item.productId}</p>
                  {item.prescriptionRef ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Rx {item.prescriptionRef}</p>
                  ) : null}
                </div>
                <p className="text-right tabular-nums">{item.quantity}</p>
                <p className="text-right tabular-nums">{formatGhs(item.unitSellingPrice)}</p>
                <p className="text-right font-semibold tabular-nums">
                  {formatGhs(item.unitSellingPrice * item.quantity)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-8 grid gap-6 border-t border-[var(--border)] pt-6 sm:grid-cols-2">
          <div className="space-y-2 text-base">
            <p className="capitalize">
              <span className="text-[var(--text-muted)]">Payment:</span>{' '}
              <span className="font-semibold">
                {sale.payment.method}
                {sale.payment.network ? ` (${sale.payment.network})` : ''}
              </span>
            </p>
            {sale.payment.method === 'cash' ? (
              <>
                <p>
                  <span className="text-[var(--text-muted)]">Tendered:</span>{' '}
                  <span className="font-semibold">{formatGhs(sale.payment.amountTendered)}</span>
                </p>
                <p>
                  <span className="text-[var(--text-muted)]">Change:</span>{' '}
                  <span className="font-semibold">{formatGhs(sale.payment.change)}</span>
                </p>
              </>
            ) : (
              <p>
                <span className="text-[var(--text-muted)]">Reference:</span>{' '}
                <span className="font-semibold">{sale.payment.reference}</span>
              </p>
            )}
          </div>

          <div className="flex items-end justify-between rounded-2xl bg-hospital-light px-5 py-4 sm:justify-end sm:gap-8 print:bg-transparent print:px-0">
            <span className="text-lg font-medium text-hospital-dark">Total</span>
            <span className="text-3xl font-bold tabular-nums text-hospital-dark">
              {formatGhs(sale.total)}
            </span>
          </div>
        </div>

        <div className="no-print mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-w-[180px] flex-1 rounded-xl bg-hospital px-5 py-3.5 text-base font-semibold text-white"
          >
            Print / Share
          </button>
          <Link
            to="/sales"
            className="rounded-xl bg-canvas px-5 py-3.5 text-base font-semibold"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <p>
      <span className="text-[var(--text-muted)]">{label}:</span>{' '}
      <span className="font-semibold break-all">{value}</span>
    </p>
  )
}
