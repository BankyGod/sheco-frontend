import { addAudit, getStore } from '../data/mockStore'
import { createReceiptNumber, createSaleId, getDeviceId } from '../utils/device'
import {
  allocateBatchesForSale,
  deductAllocations,
  getProduct,
  restoreAllocations,
} from './inventory'

const QUEUE_KEY = 'sheco_sales_queue'

export function getQueuedSales() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function listSales({ user } = {}) {
  const { sales } = getStore()
  let rows = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (user?.role === 'salesperson') {
    rows = rows.filter((s) => s.salespersonId === user.id)
  }
  return rows.map((sale) => sanitizeSale(sale, user))
}

function sanitizeSale(sale, user) {
  if (user?.role === 'salesperson') {
    return {
      ...sale,
      items: sale.items.map(({ unitCostPrice, ...rest }) => rest),
    }
  }
  return sale
}

export function getSale(id, user) {
  const sale = getStore().sales.find((s) => s.id === id)
  if (!sale) return null
  if (user?.role === 'salesperson' && sale.salespersonId !== user.id) return null
  return sanitizeSale(sale, user)
}

export async function completeSale(
  { items, payment, offline = false },
  actor,
) {
  const store = getStore()
  const lineItems = []
  let total = 0

  for (const line of items) {
    const product = getProduct(line.productId)
    if (!product || !product.active) throw new Error('Product unavailable')
    if (product.prescriptionOnly && !line.prescriptionRef) {
      throw new Error(`${product.name} requires a prescription reference`)
    }

    const allocations = allocateBatchesForSale(line.productId, line.quantity)
    for (const alloc of allocations) {
      lineItems.push({
        productId: line.productId,
        batchId: alloc.batchId,
        quantity: alloc.quantity,
        unitSellingPrice: product.sellingPrice,
        unitCostPrice: alloc.unitCostPrice,
        prescriptionRef: line.prescriptionRef || null,
      })
      total += product.sellingPrice * alloc.quantity
    }
  }

  deductAllocations(
    lineItems.map((i) => ({ batchId: i.batchId, quantity: i.quantity })),
  )

  store.receiptSeq += 1
  const sale = {
    id: createSaleId(),
    receiptNumber: createReceiptNumber(store.receiptSeq),
    deviceId: getDeviceId(),
    salespersonId: actor.id,
    createdAt: new Date().toISOString(),
    total,
    status: 'completed',
    voidReason: null,
    payment,
    items: lineItems,
    syncFlag: offline ? 'queued' : 'synced',
    needsReview: false,
  }

  if (offline) {
    const queue = getQueuedSales()
    queue.push(sale)
    saveQueue(queue)
  } else {
    store.sales.unshift(sale)
  }

  addAudit({
    userId: actor.id,
    deviceId: getDeviceId(),
    action: 'sale',
    record: `Receipt ${sale.receiptNumber}${offline ? ' (offline queue)' : ''}`,
  })

  return sanitizeSale(sale, actor)
}

export function voidSale(saleId, reason, actor) {
  const store = getStore()
  const sale = store.sales.find((s) => s.id === saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.status === 'voided') throw new Error('Sale already voided')
  if (!reason?.trim()) throw new Error('A reason is required to void a sale')

  restoreAllocations(sale.items)
  sale.status = 'voided'
  sale.voidReason = reason.trim()

  addAudit({
    userId: actor.id,
    deviceId: getDeviceId(),
    action: 'void',
    record: `Receipt ${sale.receiptNumber} — ${reason.trim()}`,
  })

  return sale
}

export function syncQueuedSales() {
  const store = getStore()
  const queue = getQueuedSales()
  if (!queue.length) return { synced: 0 }

  let synced = 0
  const remaining = []

  for (const sale of queue) {
    const exists = store.sales.some((s) => s.id === sale.id)
    if (!exists) {
      // Stock already deducted locally when queued; just accept onto server mock.
      // Flag if any batch would have gone negative conceptually.
      const review = sale.items.some((item) => {
        const batch = store.batches.find((b) => b.id === item.batchId)
        return batch && batch.quantityRemaining < 0
      })
      sale.needsReview = Boolean(review)
      sale.syncFlag = 'synced'
      store.sales.unshift(sale)
      synced += 1
    }
  }

  saveQueue(remaining)
  return { synced }
}

export function getDashboardStats() {
  const store = getStore()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const completed = store.sales.filter((s) => s.status === 'completed')
  const todaySales = completed.filter((s) => new Date(s.createdAt) >= startOfToday)
  const voided = store.sales.filter((s) => s.status === 'voided')

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.total, 0)
  const cashRevenue = todaySales
    .filter((s) => s.payment.method === 'cash')
    .reduce((s, sale) => s + sale.total, 0)
  const momoRevenue = todaySales
    .filter((s) => s.payment.method === 'momo')
    .reduce((s, sale) => s + sale.total, 0)

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekly = weekDays.map((label) => ({ day: label, sales: 0, revenue: 0 }))
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const daySales = completed.filter((s) => {
      const t = new Date(s.createdAt)
      return t >= day && t < next
    })
    const idx = day.getDay()
    weekly[idx] = {
      day: weekDays[idx],
      sales: daySales.length,
      revenue: daySales.reduce((sum, s) => sum + s.total, 0) / 100,
    }
  }

  // Rebuild weekly in Mon-Sun order starting from today-6 chronological
  const chronological = []
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const daySales = completed.filter((s) => {
      const t = new Date(s.createdAt)
      return t >= day && t < next
    })
    chronological.push({
      day: weekDays[day.getDay()],
      sales: daySales.length,
      revenue: daySales.reduce((sum, s) => sum + s.total, 0) / 100,
    })
  }

  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const label = d.toLocaleString('en', { month: 'short' })
    const monthSales = completed.filter((s) => {
      const t = new Date(s.createdAt)
      return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear()
    })
    const revenue = monthSales.reduce((sum, s) => sum + s.total, 0)
    const cost = monthSales.reduce(
      (sum, s) =>
        sum + s.items.reduce((line, item) => line + item.unitCostPrice * item.quantity, 0),
      0,
    )
    return {
      month: label,
      revenue: revenue / 100,
      profit: (revenue - cost) / 100,
    }
  })

  return {
    todayCount: todaySales.length,
    todayRevenue,
    cashRevenue,
    momoRevenue,
    voidedCount: voided.length,
    completedCount: completed.length,
    weekly: chronological,
    monthly,
  }
}

export function getReportData({ from, to } = {}) {
  const store = getStore()
  let sales = store.sales.filter((s) => s.status === 'completed')
  if (from) sales = sales.filter((s) => s.createdAt.slice(0, 10) >= from)
  if (to) sales = sales.filter((s) => s.createdAt.slice(0, 10) <= to)

  const bySalesperson = {}
  for (const sale of sales) {
    const key = sale.salespersonId
    if (!bySalesperson[key]) {
      bySalesperson[key] = { salespersonId: key, count: 0, revenue: 0, profit: 0 }
    }
    bySalesperson[key].count += 1
    bySalesperson[key].revenue += sale.total
    bySalesperson[key].profit += sale.items.reduce(
      (sum, item) => sum + (item.unitSellingPrice - item.unitCostPrice) * item.quantity,
      0,
    )
  }

  const cash = sales.filter((s) => s.payment.method === 'cash').reduce((s, x) => s + x.total, 0)
  const momo = sales.filter((s) => s.payment.method === 'momo').reduce((s, x) => s + x.total, 0)
  const momoTxns = sales
    .filter((s) => s.payment.method === 'momo')
    .map((s) => ({
      receiptNumber: s.receiptNumber,
      network: s.payment.network,
      reference: s.payment.reference,
      amount: s.total,
      createdAt: s.createdAt,
      salespersonId: s.salespersonId,
    }))

  const profit = sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (line, item) => line + (item.unitSellingPrice - item.unitCostPrice) * item.quantity,
        0,
      ),
    0,
  )

  return {
    sales,
    totals: {
      count: sales.length,
      revenue: sales.reduce((s, x) => s + x.total, 0),
      cash,
      momo,
      profit,
    },
    bySalesperson: Object.values(bySalesperson),
    momoTxns,
  }
}

export function listAuditLog(query = '') {
  const { auditLog, users } = getStore()
  const q = query.trim().toLowerCase()
  return auditLog
    .map((entry) => ({
      ...entry,
      userName: users.find((u) => u.id === entry.userId)?.name || entry.userId,
    }))
    .filter((entry) => {
      if (!q) return true
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.record.toLowerCase().includes(q) ||
        entry.userName.toLowerCase().includes(q)
      )
    })
}

export function getSettings() {
  return getStore().settings
}

export function updateSettings(patch, actor) {
  const store = getStore()
  Object.assign(store.settings, patch)
  addAudit({
    userId: actor.id,
    deviceId: getDeviceId(),
    action: 'settings',
    record: 'Updated system settings',
  })
  return store.settings
}
