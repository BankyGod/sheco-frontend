import { apiRequest, getStoredSession } from './client'
import { createReceiptNumber, createSaleId, getDeviceId } from '../utils/device'
import {
  applyOptimisticStock,
  enqueueSale,
  getQueuedSales as getQueuedFromStore,
  removeQueuedSales,
  updateQueuedSale,
} from '../utils/offlineStore'

export async function getQueuedSales() {
  return getQueuedFromStore()
}

export async function listSales() {
  return apiRequest('/sales')
}

export async function getSale(id) {
  return apiRequest(`/sales/${id}`)
}

export async function listSalesNeedingReview() {
  return apiRequest('/sales/needs-review')
}

export async function clearSaleReview(saleId, note = '') {
  return apiRequest(`/sales/${saleId}/clear-review`, {
    method: 'POST',
    body: { note: note || null },
  })
}

function shouldQueueOffline(offlineFlag) {
  const session = getStoredSession()
  return Boolean(offlineFlag || !navigator.onLine || !session?.accessToken || session?.offlineUnlock)
}

export async function completeSale({ items, payment, offline = false }) {
  const sessionUser = getStoredSession()?.user
  const payload = {
    id: createSaleId(),
    receiptNumber: createReceiptNumber(Date.now() % 10000),
    deviceId: getDeviceId(),
    createdAt: new Date().toISOString(),
    salespersonId: sessionUser?.id,
    salespersonName: sessionUser?.name || '',
    items: items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      prescriptionRef: line.prescriptionRef || null,
      unitSellingPrice: line.sellingPrice ?? line.unitSellingPrice ?? 0,
    })),
    payment: {
      method: payment.method,
      amountTendered: payment.amountTendered,
      change: payment.change || 0,
      network: payment.network || null,
      reference: payment.reference || null,
    },
    offline,
  }

  if (shouldQueueOffline(offline)) {
    const queuedSale = {
      ...payload,
      total: items.reduce((sum, line) => sum + (line.sellingPrice || 0) * line.quantity, 0),
      status: 'completed',
      voidReason: null,
      syncFlag: 'queued',
      needsReview: false,
      reviewReason: null,
      lastSyncError: null,
      items: payload.items.map((line) => {
        const source = items.find((i) => i.productId === line.productId)
        return {
          ...line,
          batchId: 'pending',
          unitSellingPrice: source?.sellingPrice || line.unitSellingPrice || 0,
        }
      }),
    }
    await enqueueSale(queuedSale)
    await applyOptimisticStock(
      queuedSale.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    )
    return queuedSale
  }

  return apiRequest('/sales', {
    method: 'POST',
    body: payload,
  })
}

export async function voidSale(saleId, reason) {
  return apiRequest(`/sales/${saleId}/void`, {
    method: 'POST',
    body: { reason },
  })
}

export async function syncQueuedSales() {
  const session = getStoredSession()
  if (!navigator.onLine) {
    return {
      synced: 0,
      alreadyExists: 0,
      failed: 0,
      blocked: 'offline',
      message: 'Still offline',
      results: [],
    }
  }
  if (!session?.accessToken || session?.offlineUnlock) {
    return {
      synced: 0,
      alreadyExists: 0,
      failed: 0,
      blocked: 'auth',
      message: 'Sign in online to sync queued sales',
      results: [],
    }
  }

  const queue = await getQueuedFromStore()
  if (!queue.length) {
    return {
      synced: 0,
      alreadyExists: 0,
      failed: 0,
      blocked: null,
      message: 'Nothing to sync',
      results: [],
    }
  }

  // Prefer per-sale requests so a single failure never wipes the queue.
  const results = []
  let synced = 0
  let alreadyExists = 0
  let failed = 0
  const removeIds = []

  for (const sale of queue) {
    try {
      const result = await apiRequest('/sales/sync', {
        method: 'POST',
        body: {
          sales: [
            {
              id: sale.id,
              receiptNumber: sale.receiptNumber,
              deviceId: sale.deviceId,
              createdAt: sale.createdAt,
              offline: true,
              salespersonId: sale.salespersonId,
              items: sale.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                prescriptionRef: item.prescriptionRef || null,
                unitSellingPrice: item.unitSellingPrice || 0,
              })),
              payment: sale.payment,
            },
          ],
        },
      })

      const row = result?.results?.[0]
      const status = row?.status || (result?.synced > 0 ? 'synced' : 'failed')
      if (status === 'synced' || status === 'already_exists') {
        if (status === 'synced') synced += 1
        else alreadyExists += 1
        removeIds.push(sale.id)
        results.push(row || { id: sale.id, status })
      } else {
        failed += 1
        const error = row?.error || 'Sync failed'
        await updateQueuedSale(sale.id, { lastSyncError: error, syncFlag: 'failed' })
        results.push(row || { id: sale.id, status: 'failed', error })
      }
    } catch (err) {
      failed += 1
      const error = err.message || 'Sync failed'
      await updateQueuedSale(sale.id, { lastSyncError: error, syncFlag: 'failed' })
      results.push({ id: sale.id, status: 'failed', error })
    }
  }

  if (removeIds.length) {
    await removeQueuedSales(removeIds)
  }

  const parts = []
  if (synced) parts.push(`Synced ${synced}`)
  if (alreadyExists) parts.push(`${alreadyExists} already on server`)
  if (failed) parts.push(`${failed} failed`)

  return {
    synced,
    alreadyExists,
    failed,
    blocked: null,
    message: parts.length ? parts.join(' · ') : 'Nothing to sync',
    results,
  }
}

export async function getDashboardStats(period = 'this-week') {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  const query = params.toString()
  return apiRequest(`/dashboard/stats${query ? `?${query}` : ''}`)
}

export async function getReportData({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return apiRequest(`/reports/sales${query ? `?${query}` : ''}`)
}

export async function listAuditLog(query = '') {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  const qs = params.toString()
  return apiRequest(`/audit${qs ? `?${qs}` : ''}`)
}

export async function getSettings() {
  return apiRequest('/settings')
}

export async function updateSettings(patch) {
  return apiRequest('/settings', {
    method: 'PATCH',
    body: patch,
  })
}

export async function purgeOperationalData() {
  return apiRequest('/admin/purge-data', {
    method: 'POST',
    body: {},
  })
}
