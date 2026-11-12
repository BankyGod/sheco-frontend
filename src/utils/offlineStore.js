const DB_NAME = 'sheco_offline'
const DB_VERSION = 1
const QUEUE_STORE = 'sales_queue'
const META_STORE = 'meta'
const LEGACY_QUEUE_KEY = 'sheco_sales_queue'
const LEGACY_CATALOGUE_KEY = 'sheco_catalogue_cache'
const CATALOGUE_META_KEY = 'catalogue'
const DASHBOARD_META_KEY = 'dashboard'
const SALES_META_KEY = 'sales'
const USERS_META_KEY = 'users'
const ALERTS_META_KEY = 'alerts'
const SETTINGS_META_KEY = 'settings'
const AUDIT_META_KEY = 'audit'
const REPORT_META_KEY = 'report'
const SYNC_TAG = 'sheco-sales-sync'

async function setMeta(key, payload, savedAt = new Date().toISOString()) {
  await withStore(META_STORE, 'readwrite', (store) => {
    store.put({
      key,
      savedAt,
      ...payload,
    })
  })
  return savedAt
}

async function getMeta(key) {
  await migrateLegacyOfflineData()
  return withStore(META_STORE, 'readonly', (store) => requestToPromise(store.get(key)))
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
  })
}

async function withStore(storeName, mode, fn) {
  const db = await openDb()
  const tx = db.transaction(storeName, mode)
  const store = tx.objectStore(storeName)
  const result = await fn(store, tx)
  await txDone(tx)
  db.close()
  return result
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

let migratePromise = null

export async function migrateLegacyOfflineData() {
  if (migratePromise) return migratePromise
  migratePromise = (async () => {
    try {
      const legacyQueue = JSON.parse(localStorage.getItem(LEGACY_QUEUE_KEY) || '[]')
      if (Array.isArray(legacyQueue) && legacyQueue.length) {
        await withStore(QUEUE_STORE, 'readwrite', async (store) => {
          for (const sale of legacyQueue) {
            if (sale?.id) store.put(sale)
          }
        })
        localStorage.removeItem(LEGACY_QUEUE_KEY)
      }
    } catch {
      /* keep legacy if parse fails */
    }

    try {
      const legacyCatalogue = JSON.parse(localStorage.getItem(LEGACY_CATALOGUE_KEY) || 'null')
      if (legacyCatalogue?.products) {
        await setCachedCatalogue(legacyCatalogue.products, legacyCatalogue.savedAt)
        localStorage.removeItem(LEGACY_CATALOGUE_KEY)
      }
    } catch {
      /* ignore */
    }
  })()
  return migratePromise
}

export async function getQueuedSales() {
  await migrateLegacyOfflineData()
  const rows = await withStore(QUEUE_STORE, 'readonly', (store) => requestToPromise(store.getAll()))
  return (rows || []).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

export async function saveQueuedSales(sales) {
  await migrateLegacyOfflineData()
  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    store.clear()
    for (const sale of sales) {
      if (sale?.id) store.put(sale)
    }
  })
}

export async function enqueueSale(sale) {
  await migrateLegacyOfflineData()
  await withStore(QUEUE_STORE, 'readwrite', (store) => {
    store.put(sale)
  })
  await requestBackgroundSync()
}

export async function removeQueuedSales(ids) {
  if (!ids?.length) return
  await migrateLegacyOfflineData()
  const idSet = new Set(ids)
  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    const all = await requestToPromise(store.getAll())
    for (const sale of all || []) {
      if (idSet.has(sale.id)) store.delete(sale.id)
    }
  })
}

export async function updateQueuedSale(id, patch) {
  await migrateLegacyOfflineData()
  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    const existing = await requestToPromise(store.get(id))
    if (!existing) return
    store.put({ ...existing, ...patch })
  })
}

export async function setCachedCatalogue(products, savedAt = new Date().toISOString()) {
  await withStore(META_STORE, 'readwrite', (store) => {
    store.put({
      key: CATALOGUE_META_KEY,
      savedAt,
      products,
      deviceId: localStorage.getItem('sheco_device_id') || '',
    })
  })
}

export async function getCachedCatalogue() {
  await migrateLegacyOfflineData()
  const row = await withStore(META_STORE, 'readonly', (store) =>
    requestToPromise(store.get(CATALOGUE_META_KEY)),
  )
  if (!row) return null
  return {
    savedAt: row.savedAt,
    products: row.products || [],
    deviceId: row.deviceId || '',
  }
}

export async function setCachedDashboard(payload, savedAt = new Date().toISOString()) {
  await setMeta(DASHBOARD_META_KEY, payload, savedAt)
}

export async function getCachedDashboard() {
  const row = await getMeta(DASHBOARD_META_KEY)
  if (!row) return null
  return {
    savedAt: row.savedAt,
    stats: row.stats || null,
    alerts: row.alerts || { lowStock: [], expiringSoon: [], expired: [] },
    recentSales: row.recentSales || [],
    users: row.users || [],
  }
}

export async function setCachedSales(sales, savedAt = new Date().toISOString()) {
  await setMeta(SALES_META_KEY, { sales: sales || [] }, savedAt)
}

export async function getCachedSales() {
  const row = await getMeta(SALES_META_KEY)
  if (!row) return null
  return { savedAt: row.savedAt, sales: row.sales || [] }
}

export async function upsertCachedSale(sale) {
  const cached = (await getCachedSales()) || { sales: [], savedAt: new Date().toISOString() }
  const sales = [...(cached.sales || []).filter((s) => s.id !== sale.id), sale].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  )
  await setCachedSales(sales, cached.savedAt)
  return sales
}

export async function setCachedUsers(users, savedAt = new Date().toISOString()) {
  await setMeta(USERS_META_KEY, { users: users || [] }, savedAt)
}

export async function getCachedUsers() {
  const row = await getMeta(USERS_META_KEY)
  if (!row) return null
  return { savedAt: row.savedAt, users: row.users || [] }
}

export async function setCachedAlerts(alerts, savedAt = new Date().toISOString()) {
  await setMeta(
    ALERTS_META_KEY,
    { alerts: alerts || { lowStock: [], expiringSoon: [], expired: [] } },
    savedAt,
  )
}

export async function getCachedAlerts() {
  const row = await getMeta(ALERTS_META_KEY)
  if (!row) return null
  return {
    savedAt: row.savedAt,
    alerts: row.alerts || { lowStock: [], expiringSoon: [], expired: [] },
  }
}

export async function setCachedSettings(settings, savedAt = new Date().toISOString()) {
  await setMeta(SETTINGS_META_KEY, { settings }, savedAt)
}

export async function getCachedSettings() {
  const row = await getMeta(SETTINGS_META_KEY)
  if (!row) return null
  return { savedAt: row.savedAt, settings: row.settings || null }
}

export async function setCachedAudit(entries, savedAt = new Date().toISOString()) {
  await setMeta(AUDIT_META_KEY, { entries: entries || [] }, savedAt)
}

export async function getCachedAudit() {
  const row = await getMeta(AUDIT_META_KEY)
  if (!row) return null
  return { savedAt: row.savedAt, entries: row.entries || [] }
}

export async function setCachedReport(report, savedAt = new Date().toISOString()) {
  await setMeta(REPORT_META_KEY, { report }, savedAt)
}

export async function getCachedReport() {
  const row = await getMeta(REPORT_META_KEY)
  if (!row) return null
  return { savedAt: row.savedAt, report: row.report || null }
}

export async function applyOptimisticStock(items) {
  const cached = await getCachedCatalogue()
  if (!cached?.products?.length) return null
  const qtyByProduct = {}
  for (const item of items) {
    qtyByProduct[item.productId] = (qtyByProduct[item.productId] || 0) + item.quantity
  }
  const products = cached.products.map((product) => {
    const sold = qtyByProduct[product.id] || 0
    if (!sold) return product
    const nextQty = Math.max(0, (product.availableQty || 0) - sold)
    return {
      ...product,
      availableQty: nextQty,
      lowStock: nextQty <= (product.reorderLevel || 0),
    }
  })
  await setCachedCatalogue(products, cached.savedAt)
  return { ...cached, products }
}

export function exportQueueJson(sales) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sales }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sheco-unsynced-sales_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    if ('sync' in reg) {
      await reg.sync.register(SYNC_TAG)
      return true
    }
  } catch {
    return false
  }
  return false
}

export { SYNC_TAG }
