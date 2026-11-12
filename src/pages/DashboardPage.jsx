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
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weekly || []}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A9BCF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4A9BCF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4A9BCF"
                  fill="url(#salesFill)"
                  strokeWidth={3}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Total Revenue</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthly || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `GHS ${Number(v).toLocaleString()}`} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4A9BCF"
                  strokeWidth={3}
                  dot={false}
                  animationDuration={1400}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={false}
                  animationDuration={1400}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Customer Map</h3>
          <p className="text-xs text-[var(--text-muted)]">Daily sales volume</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="sales"
                  fill="#4A9BCF"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </BarChart>
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
      <div className="relative h-[100px] w-[100px]">
        <svg width="100" height="100" className="-rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={radius} stroke="#eef0f4" strokeWidth="10" fill="none" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="10"
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
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
