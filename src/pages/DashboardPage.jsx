import { useMemo, useState } from 'react'
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
import { getDashboardStats, listSales } from '../api/sales'
import { getStockAlerts } from '../api/inventory'
import { formatGhs } from '../utils/money'
import { listUsers } from '../api/auth'

export default function DashboardPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('this-week')
  const stats = useMemo(() => getDashboardStats(), [])
  const alerts = useMemo(() => getStockAlerts(), [])
  const recentSales = useMemo(() => listSales().slice(0, 6), [])
  const users = useMemo(() => listUsers(), [])

  const cashShare = stats.todayRevenue
    ? Math.round((stats.cashRevenue / stats.todayRevenue) * 100)
    : 0
  const momoShare = stats.todayRevenue
    ? Math.round((stats.momoRevenue / stats.todayRevenue) * 100)
    : 0
  const lowStockShare = Math.min(100, alerts.lowStock.length * 18)
  const expiryShare = Math.min(100, alerts.expiringSoon.length * 20)

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
          value={alerts.lowStock.length}
          trend="At or below reorder level"
          icon={PackageMinus}
          accent="warning"
        />
        <StatCard
          label="Expiring Soon"
          value={alerts.expiringSoon.length}
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
              <AreaChart data={stats.weekly}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A9BCF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4A9BCF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="sales" stroke="#4A9BCF" fill="url(#salesFill)" strokeWidth={3} />
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
              <LineChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#4A9BCF" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="profit" stroke="#ef4444" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Customer Map</h3>
          <p className="text-xs text-[var(--text-muted)]">Daily sales volume</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="sales" fill="#4A9BCF" radius={[8, 8, 0, 0]} />
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
            const seller = users.find((u) => u.id === sale.salespersonId)
            return (
              <div key={sale.id} className="relative rounded-2xl border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{seller?.name || 'Salesperson'}</p>
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
          {alerts.expiringSoon.slice(0, 3).map(({ product, batch, daysToExpiry }) => (
            <div key={batch.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="font-semibold">{product.name}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Batch {batch.batchNumber} expires in {daysToExpiry} days
              </p>
              <p className="mt-3 text-sm text-amber-700">Qty remaining: {batch.quantityRemaining}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Ring({ label, value, color }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[100px] w-[100px]">
        <svg width="100" height="100" className="-rotate-90">
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
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {value}%
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
