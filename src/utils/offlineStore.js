const DB_NAME = 'sheco_offline'
const DB_VERSION = 1
const QUEUE_STORE = 'sales_queue'
const META_STORE = 'meta'
const LEGACY_QUEUE_KEY = 'sheco_sales_queue'
const LEGACY_CATALOGUE_KEY = 'sheco_catalogue_cache'
const CATALOGUE_META_KEY = 'catalogue'
const SYNC_TAG = 'sheco-sales-sync'

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
