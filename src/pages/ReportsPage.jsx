import { useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { getReportData } from '../api/sales'
import { listUsers } from '../api/auth'
import { listProducts } from '../api/inventory'
import { formatGhs } from '../utils/money'
import { exportReportCsv, exportReportExcel } from '../utils/reportExport'

export default function ReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [reportData, userRows, productRows] = await Promise.all([
          getReportData({ from: from || undefined, to: to || undefined }),
          listUsers(),
          listProducts({ includeInactive: true }),
        ])
        if (!active) return
        setReport(reportData)
        setUsers(userRows)
        setProducts(productRows)
        setError('')
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [from, to])

  async function handleExcelExport() {
    if (!report) return
    setExporting('excel')
    setError('')
    try {
      await exportReportExcel(report, users, products, { from, to })
    } catch (err) {
      setError(err.message || 'Excel export failed')
    } finally {
      setExporting('')
    }
  }

  function handleCsvExport() {
    if (!report) return
    setExporting('csv')
    setError('')
    try {
      exportReportCsv(report, users, products, { from, to })
    } catch (err) {
      setError(err.message || 'CSV export failed')
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Reports</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Revenue, cash vs MoMo, salesperson totals, and profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FileSpreadsheet size={16} />
            {exporting === 'excel' ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={handleCsvExport}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-hospital-dark shadow-[var(--shadow)] disabled:opacity-60"
          >
            <FileDown size={16} />
            {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow)]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>
      </div>

      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading report...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Sales count" value={report.totals.count} />
            <Metric label="Revenue" value={formatGhs(report.totals.revenue)} />
            <Metric label="Cash" value={formatGhs(report.totals.cash)} />
            <Metric label="Mobile Money" value={formatGhs(report.totals.momo)} />
            <Metric label="Profit" value={formatGhs(report.totals.profit)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
              <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">By salesperson</div>
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Sales</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
                    <th className="px-4 py-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySalesperson.map((row) => (
                    <tr key={row.salespersonId} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        {row.salespersonName ||
                          users.find((u) => String(u.id) === String(row.salespersonId))?.name ||
                          row.salespersonId}
                      </td>
                      <td className="px-4 py-3">{row.count}</td>
                      <td className="px-4 py-3">{formatGhs(row.revenue)}</td>
                      <td className="px-4 py-3">{formatGhs(row.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
              <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
                MoMo reconciliation
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3 font-medium">Salesperson</th>
                    <th className="px-4 py-3 font-medium">Network</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.momoTxns.map((txn) => (
                    <tr key={txn.receiptNumber} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">{txn.receiptNumber}</td>
                      <td className="px-4 py-3">
                        {txn.salespersonName ||
                          users.find((u) => String(u.id) === String(txn.salespersonId))?.name ||
                          txn.salespersonId}
                      </td>
                      <td className="px-4 py-3">{txn.network}</td>
                      <td className="px-4 py-3">{txn.reference}</td>
                      <td className="px-4 py-3">{formatGhs(txn.amount)}</td>
                    </tr>
                  ))}
                  {!report.momoTxns.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-[var(--text-muted)]">
                        No MoMo transactions in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
            <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
              Sales detail
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Salesperson</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.sales || []).map((sale) => {
                    const profit = (sale.items || []).reduce(
                      (sum, item) =>
                        sum +
                        (item.unitSellingPrice - (item.unitCostPrice || 0)) * item.quantity,
                      0,
                    )
                    const units = (sale.items || []).reduce((sum, item) => sum + item.quantity, 0)
                    return (
                      <tr key={sale.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 font-medium">{sale.receiptNumber}</td>
                        <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {sale.salespersonName ||
                            users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
                            sale.salespersonId}
                        </td>
                        <td className="px-4 py-3 capitalize">{sale.payment?.method}</td>
                        <td className="px-4 py-3">{units}</td>
                        <td className="px-4 py-3">{formatGhs(sale.total)}</td>
                        <td className="px-4 py-3">{formatGhs(profit)}</td>
                      </tr>
                    )
                  })}
                  {!(report.sales || []).length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-[var(--text-muted)]">
                        No sales in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
