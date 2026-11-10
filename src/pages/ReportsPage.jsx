import { useMemo, useState } from 'react'
import { getReportData } from '../api/sales'
import { listUsers } from '../api/auth'
import { formatGhs } from '../utils/money'

export default function ReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useMemo(() => getReportData({ from: from || undefined, to: to || undefined }), [from, to])
  const users = useMemo(() => listUsers(), [])

  function exportCsv() {
    const rows = [
      ['Receipt', 'Date', 'Salesperson', 'Method', 'Network', 'Reference', 'Total (pesewas)'],
      ...report.sales.map((sale) => [
        sale.receiptNumber,
        sale.createdAt,
        users.find((u) => u.id === sale.salespersonId)?.name || sale.salespersonId,
        sale.payment.method,
        sale.payment.network || '',
        sale.payment.reference || '',
        sale.total,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sheco-sales-report.csv'
    a.click()
    URL.revokeObjectURL(url)
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
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white"
        >
          Export Excel/CSV
        </button>
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
                    {users.find((u) => u.id === row.salespersonId)?.name || row.salespersonId}
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
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.momoTxns.map((txn) => (
                <tr key={txn.receiptNumber} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">{txn.receiptNumber}</td>
                  <td className="px-4 py-3">{txn.network}</td>
                  <td className="px-4 py-3">{txn.reference}</td>
                  <td className="px-4 py-3">{formatGhs(txn.amount)}</td>
                </tr>
              ))}
              {!report.momoTxns.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-[var(--text-muted)]">
                    No MoMo transactions in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
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
