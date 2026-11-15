import { useEffect, useMemo, useState } from 'react'
import {
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  List,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getReportData } from '../api/sales'
import { listUsers } from '../api/auth'
import { listProducts } from '../api/inventory'
import { formatGhs, fromPesewas } from '../utils/money'
import { exportReportCsv, exportReportExcel } from '../utils/reportExport'
import {
  getCachedCatalogue,
  getCachedReport,
  getCachedUsers,
  setCachedReport,
} from '../utils/offlineStore'

export default function ReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [exporting, setExporting] = useState('')
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'

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
        setFromCache(false)
        setError('')
        await setCachedReport(reportData)
      } catch (err) {
        if (!active) return
        const [cachedReport, cachedUsers, cachedProducts] = await Promise.all([
          getCachedReport(),
          getCachedUsers(),
          getCachedCatalogue(),
        ])
        if (cachedReport?.report || cachedProducts?.products?.length) {
          setReport(cachedReport?.report || null)
          setUsers(cachedUsers?.users || [])
          setProducts(cachedProducts?.products || [])
          setFromCache(true)
          setError('')
        } else if (active) {
          setError(err.message)
        }
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

  // Derive charts data from report.sales
  const chartData = useMemo(() => {
    if (!report?.sales?.length) return []
    const sales = [...report.sales].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    // Determine grouping: by date or by hour if same day
    const firstDate = sales[0].createdAt.slice(0, 10)
    const lastDate = sales[sales.length - 1].createdAt.slice(0, 10)
    const isSingleDay = firstDate === lastDate

    const map = new Map()

    for (const sale of sales) {
      const d = new Date(sale.createdAt)
      const key = isSingleDay
        ? `${String(d.getHours()).padStart(2, '0')}:00`
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

      if (!map.has(key)) {
        map.set(key, { label: key, sales: 0, revenue: 0, profit: 0 })
      }
      const entry = map.get(key)
      entry.sales += 1
      entry.revenue += fromPesewas(sale.total)

      const saleProfit = (sale.items || []).reduce(
        (sum, item) =>
          sum + (item.unitSellingPrice - (item.unitCostPrice || 0)) * item.quantity,
        0,
      )
      entry.profit += fromPesewas(saleProfit)
    }

    return Array.from(map.values()).map((row) => ({
      ...row,
      revenue: Math.round(row.revenue * 100) / 100,
      profit: Math.round(row.profit * 100) / 100,
    }))
  }, [report])

  // Bar chart data by salesperson
  const salespersonChartData = useMemo(() => {
    if (!report?.bySalesperson?.length) return []
    return report.bySalesperson.map((sp) => {
      const name =
        sp.salespersonName ||
        users.find((u) => String(u.id) === String(sp.salespersonId))?.name ||
        sp.salespersonId
      return {
        label: name.split(' ')[0], // first name for compact chart label
        fullName: name,
        sales: sp.count,
        revenue: Math.round(fromPesewas(sp.revenue)),
        profit: Math.round(fromPesewas(sp.profit)),
      }
    })
  }, [report, users])

  const totals = report?.totals
  const cashShare = totals?.revenue ? Math.round((totals.cash / totals.revenue) * 100) : 0
  const momoShare = totals?.revenue ? Math.round((totals.momo / totals.revenue) * 100) : 0
  const profitMargin = totals?.revenue ? Math.round((totals.profit / totals.revenue) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header and Export Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Reports & Analytics</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Revenue trends, salesperson performance, MoMo reconciliation, and detailed sales audit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={handleExcelExport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-hospital px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-hospital-dark disabled:opacity-60"
          >
            <FileSpreadsheet size={16} />
            {exporting === 'excel' ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={handleCsvExport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-hospital-dark shadow-[var(--shadow)] transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FileDown size={16} />
            {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Date Filters & Mobile View Switcher */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex-1 sm:flex-none text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-hospital"
            />
          </label>
          <label className="flex-1 sm:flex-none text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-hospital"
            />
          </label>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="mt-4 sm:mt-5 text-xs font-semibold text-hospital hover:underline"
            >
              Clear dates
            </button>
          )}
        </div>

        {/* View Mode Switcher for Mobile Devices */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 sm:border-t-0 sm:pt-0">
          <span className="text-xs text-[var(--text-muted)] md:hidden">Table display:</span>
          <div className="inline-flex rounded-xl bg-canvas p-1 md:hidden">
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
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing the last saved report on this device.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading report & analytics...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {report ? (
        <>
          {/* Key Metric Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Metric label="Sales Completed" value={report.totals.count} />
            <Metric label="Total Revenue" value={formatGhs(report.totals.revenue)} highlight />
            <Metric label="Cash Revenue" value={formatGhs(report.totals.cash)} />
            <Metric label="Mobile Money" value={formatGhs(report.totals.momo)} />
            <Metric
              label="Net Profit"
              value={formatGhs(report.totals.profit)}
              accent="emerald"
            />
          </div>

          {/* ===================== CHARTS SECTION (MOVED FROM DASHBOARD) ===================== */}
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
            {/* Payment & Profit Share Rings */}
            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payment & Margin Share</h3>
                <span className="text-xs text-[var(--text-muted)]">Distribution</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-around gap-4">
                <Ring label="Cash Share" value={cashShare} color="#10b981" />
                <Ring label="MoMo Share" value={momoShare} color="#3b82f6" />
                <Ring label="Profit Margin" value={profitMargin} color="#f59e0b" />
              </div>
              <div className="mt-6 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)] flex justify-around">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Cash: {cashShare}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> MoMo: {momoShare}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Margin: {profitMargin}%
                </span>
              </div>
            </div>

            {/* Sales Volume / Orders Trend (Area Chart) */}
            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Sales Orders Trend</h3>
                <span className="rounded-xl bg-hospital-light px-2.5 py-1 text-xs font-semibold text-hospital-dark">
                  Transactions
                </span>
              </div>
              <div className="mt-4 h-60">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="salesReportFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4A9BCF" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4A9BCF" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="Orders"
                        stroke="#4A9BCF"
                        fill="url(#salesReportFill)"
                        strokeWidth={3}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                    No transactions to plot in this range.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1.1fr]">
            {/* Total Revenue vs Profit Trend (Line Chart) */}
            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Revenue & Profit Over Time</h3>
                  <p className="text-xs text-[var(--text-muted)]">Comparison in GHS</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-medium text-hospital-dark">
                    <span className="h-2.5 w-2.5 rounded-full bg-hospital" /> Revenue
                  </span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Profit
                  </span>
                </div>
              </div>
              <div className="mt-4 h-64">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `GHS ${Number(v).toLocaleString()}`} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#4A9BCF"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        animationDuration={1200}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        name="Profit"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        animationDuration={1200}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                    No revenue data in this period.
                  </div>
                )}
              </div>
            </div>

            {/* Sales Volume by Staff / Timeline (Bar Chart) */}
            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Staff Sales Volume</h3>
                  <p className="text-xs text-[var(--text-muted)]">Completed sales per salesperson</p>
                </div>
              </div>
              <div className="mt-4 h-64">
                {salespersonChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salespersonChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(value, name) => [value, name === 'sales' ? 'Sales Count' : name]} />
                      <Bar
                        dataKey="sales"
                        name="Sales Count"
                        fill="#4A9BCF"
                        radius={[6, 6, 0, 0]}
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                    No staff sales recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===================== TABLES SECTION (MOBILE OPTIMIZED) ===================== */}

          {/* Table 1 & Table 2 in Grid */}
          <div className="grid gap-6 xl:grid-cols-2 min-w-0">
            {/* Table 1: By Salesperson */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <span className="font-semibold text-[var(--text)]">By Salesperson</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {report.bySalesperson?.length || 0} staff active
                </span>
              </div>

              {/* Mobile Card Layout */}
              <div className={mobileViewMode === 'cards' ? 'space-y-2 p-3 md:hidden' : 'hidden'}>
                {report.bySalesperson.map((row) => {
                  const name =
                    row.salespersonName ||
                    users.find((u) => String(u.id) === String(row.salespersonId))?.name ||
                    row.salespersonId
                  return (
                    <article
                      key={row.salespersonId}
                      className="rounded-xl border border-[var(--border)] bg-canvas/60 p-3.5 transition hover:border-hospital-soft"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[var(--text)]">{name}</p>
                          <span className="inline-block mt-0.5 rounded-full bg-hospital-light px-2 py-0.5 text-[11px] font-semibold text-hospital-dark">
                            {row.count} {row.count === 1 ? 'sale' : 'sales'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Revenue</p>
                          <p className="font-semibold text-sm mt-0.5">{formatGhs(row.revenue)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Profit</p>
                          <p className="font-semibold text-sm mt-0.5 text-emerald-700">{formatGhs(row.profit)}</p>
                        </div>
                      </div>
                    </article>
                  )
                })}
                {!report.bySalesperson.length ? (
                  <p className="py-4 text-center text-sm text-[var(--text-muted)]">No staff sales in this range.</p>
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
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead className="bg-canvas text-[var(--text-muted)]">
                      <tr>
                        <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                          Name
                        </th>
                        <th className="px-4 py-3 font-medium">Sales</th>
                        <th className="px-4 py-3 font-medium">Revenue</th>
                        <th className="px-4 py-3 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.bySalesperson.map((row) => (
                        <tr key={row.salespersonId} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                          <td className="sticky left-0 bg-white z-10 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                            {row.salespersonName ||
                              users.find((u) => String(u.id) === String(row.salespersonId))?.name ||
                              row.salespersonId}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">{row.count}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium">{formatGhs(row.revenue)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-emerald-700 font-medium">{formatGhs(row.profit)}</td>
                        </tr>
                      ))}
                      {!report.bySalesperson.length ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-muted)]">
                            No salesperson records found in this range.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Table 2: MoMo Reconciliation */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <span className="font-semibold text-[var(--text)]">MoMo Reconciliation</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {report.momoTxns?.length || 0} transactions
                </span>
              </div>

              {/* Mobile Card Layout */}
              <div className={mobileViewMode === 'cards' ? 'space-y-2 p-3 md:hidden' : 'hidden'}>
                {report.momoTxns.map((txn) => {
                  const seller =
                    txn.salespersonName ||
                    users.find((u) => String(u.id) === String(txn.salespersonId))?.name ||
                    txn.salespersonId
                  return (
                    <article
                      key={txn.receiptNumber}
                      className="rounded-xl border border-[var(--border)] bg-canvas/60 p-3.5 transition hover:border-hospital-soft"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-bold text-hospital-dark">{txn.receiptNumber}</p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">By: {seller}</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 uppercase">
                          {txn.network || 'MoMo'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-2.5 border border-[var(--border)]">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Ref / Transaction ID</p>
                          <p className="font-mono text-xs font-semibold truncate text-[var(--text)]">
                            {txn.reference || '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Amount</p>
                          <p className="text-sm font-bold text-[var(--text)]">{formatGhs(txn.amount)}</p>
                        </div>
                      </div>
                    </article>
                  )
                })}
                {!report.momoTxns.length ? (
                  <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                    No MoMo transactions in this range.
                  </p>
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
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-canvas text-[var(--text-muted)]">
                      <tr>
                        <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] font-mono text-xs min-w-[120px]">
                          Receipt
                        </th>
                        <th className="px-4 py-3 font-medium">Salesperson</th>
                        <th className="px-4 py-3 font-medium">Network</th>
                        <th className="px-4 py-3 font-medium">Reference</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.momoTxns.map((txn) => (
                        <tr key={txn.receiptNumber} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                          <td className="sticky left-0 bg-white z-10 whitespace-nowrap px-4 py-3 font-mono font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[120px]">
                            {txn.receiptNumber}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {txn.salespersonName ||
                              users.find((u) => String(u.id) === String(txn.salespersonId))?.name ||
                              txn.salespersonId}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 uppercase font-medium">{txn.network}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{txn.reference}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatGhs(txn.amount)}</td>
                        </tr>
                      ))}
                      {!report.momoTxns.length ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                            No MoMo transactions in this range.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Table 3: Sales Detail */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="font-semibold text-[var(--text)]">Sales Detail Audit</span>
              <span className="text-xs text-[var(--text-muted)]">
                {report.sales?.length || 0} sales recorded
              </span>
            </div>

            {/* Mobile Card Layout */}
            <div className={mobileViewMode === 'cards' ? 'space-y-2 p-3 md:hidden' : 'hidden'}>
              {(report.sales || []).map((sale) => {
                const profit = (sale.items || []).reduce(
                  (sum, item) =>
                    sum + (item.unitSellingPrice - (item.unitCostPrice || 0)) * item.quantity,
                  0,
                )
                const units = (sale.items || []).reduce((sum, item) => sum + item.quantity, 0)
                const seller =
                  sale.salespersonName ||
                  users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
                  sale.salespersonId

                return (
                  <article
                    key={sale.id}
                    className="rounded-xl border border-[var(--border)] bg-canvas/60 p-3.5 transition hover:border-hospital-soft"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-bold text-hospital-dark">{sale.receiptNumber}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {new Date(sale.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-hospital-light px-2.5 py-0.5 text-[11px] font-semibold text-hospital-dark capitalize">
                        {sale.payment?.method || 'Cash'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Salesperson</p>
                        <p className="font-medium truncate">{seller}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Units Sold</p>
                        <p className="font-medium">{units} units</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Total</p>
                        <p className="font-bold text-sm">{formatGhs(sale.total)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[var(--border)]">
                        <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Profit</p>
                        <p className="font-bold text-sm text-emerald-700">{formatGhs(profit)}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
              {!(report.sales || []).length ? (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">No sales in this range.</p>
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
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-canvas text-[var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] font-mono text-xs min-w-[120px]">
                        Receipt
                      </th>
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
                        <tr key={sale.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                          <td className="sticky left-0 bg-white z-10 whitespace-nowrap px-4 py-3 font-mono font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[120px]">
                            {sale.receiptNumber}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">
                            {new Date(sale.createdAt).toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {sale.salespersonName ||
                              users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
                              sale.salespersonId}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 capitalize">{sale.payment?.method}</td>
                          <td className="whitespace-nowrap px-4 py-3">{units}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatGhs(sale.total)}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">{formatGhs(profit)}</td>
                        </tr>
                      )
                    })}
                    {!(report.sales || []).length ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-muted)]">
                          No sales found in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value, highlight = false, accent = '' }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-[var(--shadow)] ${
        highlight
          ? 'bg-hospital text-white'
          : 'bg-white text-[var(--text)]'
      }`}
    >
      <p className={`text-xs ${highlight ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold tracking-tight ${
          highlight
            ? 'text-white'
            : accent === 'emerald'
              ? 'text-emerald-600'
              : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function Ring({ label, value, color }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOffset(circumference - (clamped / 100) * circumference)
    })
    return () => cancelAnimationFrame(frame)
  }, [clamped, circumference])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[92px] w-[92px]">
        <svg width="92" height="92" className="-rotate-90" aria-hidden>
          <circle cx="46" cy="46" r={radius} stroke="#eef0f4" strokeWidth="9" fill="none" />
          <circle
            cx="46"
            cy="46"
            r={radius}
            stroke={color}
            strokeWidth="9"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {clamped}%
        </div>
      </div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
