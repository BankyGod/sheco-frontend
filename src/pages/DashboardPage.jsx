import { useEffect, useState } from 'react'
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
import {
  CalendarDays,
  CircleDollarSign,
  PackageMinus,
  Receipt,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { getDashboardStats, listSales } from '../api/sales'
import { getStockAlerts } from '../api/inventory'
import { formatGhs } from '../utils/money'
import { listUsers } from '../api/auth'
import { getCachedDashboard, setCachedDashboard } from '../utils/offlineStore'

export default function DashboardPage() {
  const { user } = useAuth()
  const { online } = useOffline()
  const [period, setPeriod] = useState('this-week')
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [] })
  const [recentSales, setRecentSales] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [cacheSavedAt, setCacheSavedAt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [dashboard, stockAlerts, sales, userRows] = await Promise.all([
          getDashboardStats(),
          getStockAlerts(),
          listSales(),
          listUsers(),
        ])
        if (!active) return
        setStats(dashboard)
        setAlerts(stockAlerts)
        setRecentSales(sales.slice(0, 6))
        setUsers(userRows)
        setFromCache(false)
        setCacheSavedAt('')
        setError('')
        await setCachedDashboard({
          stats: dashboard,
          alerts: stockAlerts,
          recentSales: sales.slice(0, 6),
          users: userRows,
        })
      } catch (err) {
        if (!active) return
        const cached = await getCachedDashboard()
        if (cached?.stats) {
          setStats(cached.stats)
          setAlerts(cached.alerts || { lowStock: [], expiringSoon: [], expired: [] })
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
  }, [online])

  if (loading) {
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
  const lowStockShare = Math.min(100, (alerts.lowStock?.length || 0) * 18)
  const expiryShare = Math.min(100, (alerts.expiringSoon?.length || 0) * 20)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Hi, {user?.name?.split(' ')[0]}. Welcome back to Sheco!
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium shadow-[var(--shadow)]"
          onClick={() => setPeriod(period === 'this-week' ? 'this-month' : 'this-week')}
        >
          <CalendarDays size={16} className="text-hospital" />
          Filter Period
          <span className="text-[var(--text-muted)]">
            {period === 'this-week' ? 'This week' : 'This month'}
          </span>
        </button>
      </div>

      {!online || fromCache ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {!online ? 'You are offline. ' : 'Server unreachable. '}
          Showing the last saved dashboard
          {cacheSavedAt ? ` from ${new Date(cacheSavedAt).toLocaleString()}` : ''}. Charts stay
          available from cache.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={stats.todayCount}
          trend="Completed sales today"
          icon={ShoppingBag}
        />
        <StatCard
          label="Today's Revenue"
          value={formatGhs(stats.todayRevenue)}
          trend={`Cash ${formatGhs(stats.cashRevenue)} · MoMo ${formatGhs(stats.momoRevenue)}`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Low Stock Items"
          value={alerts.lowStock?.length || 0}
          trend="At or below reorder level"
          icon={PackageMinus}
          accent="warning"
        />
        <StatCard
          label="Expiring Soon"
          value={alerts.expiringSoon?.length || 0}
          trend="Within 90 days"
          icon={TriangleAlert}
          accent="danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Pie Chart</h3>
          <div className="mt-6 flex flex-wrap items-center justify-around gap-4">
            <Ring label="Cash Share" value={cashShare} color="#ef4444" />
            <Ring label="Low Stock" value={lowStockShare} color="#22c55e" />
            <Ring label="MoMo Share" value={momoShare || expiryShare} color="#3b82f6" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Chart Order</h3>
            <button type="button" className="rounded-xl bg-hospital px-3 py-2 text-xs font-semibold text-white">
              Save Report
            </button>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weekRevenue || []}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A9BCF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4A9BCF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatGhs(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#2E7BA8" fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Total Revenue</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatGhs(v)} />
                <Bar dataKey="revenue" fill="#4A9BCF" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Customer Map</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weekRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sales" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Sales & Alerts</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {recentSales.map((sale) => {
            const seller =
              sale.salespersonName ||
              users.find((u) => String(u.id) === String(sale.salespersonId))?.name ||
              'Salesperson'
            return (
              <div key={sale.id} className="relative rounded-2xl border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{seller}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-hospital-light text-hospital-dark">
                    <Receipt size={18} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  {sale.receiptNumber} · {sale.payment.method.toUpperCase()}
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

function Ring({ label, value, color }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${clamped}%, #e5e7eb 0)`,
        }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-sm font-semibold">
          {clamped}%
        </div>
      </div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
