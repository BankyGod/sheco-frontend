import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  Package,
  PackageMinus,
  PlusCircle,
  Receipt,
  ShoppingBag,
  Smartphone,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { getDashboardStats, listSales } from '../api/sales'
import { getStockAlerts, listProducts } from '../api/inventory'
import { formatGhs } from '../utils/money'
import { listUsers } from '../api/auth'
import { getCachedDashboard, setCachedDashboard } from '../utils/offlineStore'

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-year', label: 'This year' },
  { id: 'all-time', label: 'All time' },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const { online } = useOffline()
  const [period, setPeriod] = useState('this-week')
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef(null)
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [] })
  const [products, setProducts] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [cacheSavedAt, setCacheSavedAt] = useState('')
  const [loading, setLoading] = useState(true)

  const periodMeta = PERIODS.find((p) => p.id === period) || PERIODS[1]

  useEffect(() => {
    function onDocClick(event) {
      if (!periodRef.current?.contains(event.target)) setPeriodOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [dashboard, stockAlerts, sales, userRows, productRows] = await Promise.all([
          getDashboardStats(period),
          getStockAlerts(),
          listSales(),
          listUsers(),
          listProducts({ includeInactive: false }),
        ])
        if (!active) return
        setStats(dashboard)
        setAlerts(stockAlerts)
        setProducts(productRows || [])
        setRecentSales(sales.slice(0, 6))
        setUsers(userRows)
        setFromCache(false)
        setCacheSavedAt('')
        setError('')
        await setCachedDashboard({
          period,
          stats: dashboard,
          alerts: stockAlerts,
          products: productRows || [],
          recentSales: sales.slice(0, 6),
          users: userRows,
        })
      } catch (err) {
        if (!active) return
        const cached = await getCachedDashboard()
        if (cached?.stats) {
          setStats(cached.stats)
          setAlerts(cached.alerts || { lowStock: [], expiringSoon: [], expired: [] })
          setProducts(cached.products || [])
          setRecentSales(cached.recentSales || [])
          setUsers(cached.users || [])
          setFromCache(true)
          setCacheSavedAt(cached.savedAt || '')
          setError('')
        } else {
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
  }, [online, period])

  if (loading && !stats) {
    return <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
  }

  if (error || !stats) {
    return <p className="text-sm text-red-500">{error || 'Unable to load dashboard'}</p>
  }

  const cashShare = stats.todayRevenue
    ? Math.round((stats.cashRevenue / stats.todayRevenue) * 100)
    : 0
  const momoShare = stats.todayRevenue
    ? Math.round((stats.momoRevenue / stats.todayRevenue) * 100)
    : 0

  const salesLabel = `${periodMeta.label} sales`
  const revenueLabel = `${periodMeta.label} revenue`

  return (
    <div className="space-y-6">
      {/* Header with Greeting & Period Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Hi, {user?.name?.split(' ')[0]}. Welcome back to Sheco!
          </p>
        </div>
        <div className="relative" ref={periodRef}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium shadow-[var(--shadow)] transition hover:bg-canvas"
            onClick={() => setPeriodOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={periodOpen}
          >
            <CalendarDays size={16} className="text-hospital" />
            <span className="hidden sm:inline">Filter Period:</span>
            <span className="font-semibold text-hospital-dark">{periodMeta.label}</span>
            <ChevronDown size={14} className="text-[var(--text-muted)]" />
          </button>
          {periodOpen ? (
            <div
              role="listbox"
              className="absolute left-0 sm:left-auto sm:right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg"
            >
              {PERIODS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === period}
                  className={`flex w-full px-4 py-2.5 text-left text-sm transition hover:bg-hospital-light ${
                    option.id === period ? 'font-semibold text-hospital-dark' : 'text-[var(--text)]'
                  }`}
                  onClick={() => {
                    setPeriod(option.id)
                    setPeriodOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!online || fromCache ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {!online ? 'You are offline. ' : 'Server unreachable. '}
          Showing the last saved dashboard
          {cacheSavedAt ? ` from ${new Date(cacheSavedAt).toLocaleString()}` : ''}.
        </p>
      ) : null}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={salesLabel}
          value={stats.todayCount}
          trend={`Completed sales · ${periodMeta.label}`}
          icon={ShoppingBag}
          compact
        />
        <StatCard
          label={revenueLabel}
          value={formatGhs(stats.todayRevenue)}
          trend={`Cash ${formatGhs(stats.cashRevenue)} · MoMo ${formatGhs(stats.momoRevenue)}`}
          icon={CircleDollarSign}
          compact
        />
        <StatCard
          label="Total Products"
          value={products.length}
          trend={`${products.filter((p) => (p.availableQty || 0) > 0).length} in stock`}
          icon={Package}
          compact
        />
        <StatCard
          label="Low Stock Items"
          value={alerts.lowStock?.length || 0}
          trend="At or below reorder level"
          icon={PackageMinus}
          accent="warning"
          compact
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label="Expiring Soon"
            value={alerts.expiringSoon?.length || 0}
            trend="Within 90 days"
            icon={TriangleAlert}
            accent="danger"
            compact
          />
        </div>
      </div>

      {/* Overview Panels: Quick Actions, Payment Breakdown, and Stock Health */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Payment Summary */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Payment Breakdown</h3>
            <span className="text-xs text-[var(--text-muted)]">{periodMeta.label}</span>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text)]">
                  <Wallet size={15} className="text-emerald-600" /> Cash
                </span>
                <span className="font-semibold">{formatGhs(stats.cashRevenue)} ({cashShare}%)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${cashShare}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text)]">
                  <Smartphone size={15} className="text-hospital" /> Mobile Money
                </span>
                <span className="font-semibold">{formatGhs(stats.momoRevenue)} ({momoShare}%)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-hospital transition-all duration-700"
                  style={{ width: `${momoShare}%` }}
                />
              </div>
            </div>

            <div className="pt-2 text-right">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-xs font-semibold text-hospital hover:underline"
              >
                View Detailed Reports & Charts <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Stock Health */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Stock Health</h3>
            <Link
              to="/inventory"
              className="text-xs font-semibold text-hospital hover:underline"
            >
              Inventory
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">Low stock</p>
              <p className="mt-1 text-xl font-bold text-amber-800">{alerts.lowStock?.length || 0}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-xs text-red-600">Expiring</p>
              <p className="mt-1 text-xl font-bold text-red-700">{alerts.expiringSoon?.length || 0}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-center">
              <p className="text-xs text-slate-600">Expired</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{alerts.expired?.length || 0}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            FEFO policy active. Expired batches cannot be dispensed at POS.
          </p>
        </div>

        {/* Quick Shortcuts */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)] md:col-span-2 xl:col-span-1">
          <h3 className="font-semibold text-[var(--text)]">Quick Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <Link
              to="/pos"
              className="flex items-center gap-2 rounded-xl bg-hospital-light px-3 py-2.5 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
            >
              <PlusCircle size={16} /> New Sale
            </Link>
            <Link
              to="/inventory"
              className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs font-semibold text-[var(--text)] transition hover:bg-slate-200"
            >
              <Boxes size={16} /> Restock
            </Link>
            <Link
              to="/reports"
              className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs font-semibold text-[var(--text)] transition hover:bg-slate-200"
            >
              <FileBarChart size={16} /> Reports & Charts
            </Link>
            <Link
              to="/sales"
              className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs font-semibold text-[var(--text)] transition hover:bg-slate-200"
            >
              <Receipt size={16} /> All Sales
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Sales</h3>
          <Link to="/sales" className="text-xs font-semibold text-hospital hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentSales.map((sale) => {
            const seller =
              sale.salespersonName ||
              users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
              'Salesperson'
            return (
              <div key={sale.id} className="relative rounded-2xl border border-[var(--border)] p-4 transition hover:border-hospital-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{seller}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hospital-light text-hospital-dark">
                    <Receipt size={18} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  {sale.receiptNumber} · {sale.payment?.method?.toUpperCase()}
                  {sale.status === 'voided' ? ' · VOIDED' : ''}
                </p>
                <p className="mt-2 text-lg font-semibold">{formatGhs(sale.total)}</p>
              </div>
            )
          })}
          {!recentSales.length ? (
            <p className="text-sm text-[var(--text-muted)]">No recent sales yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
