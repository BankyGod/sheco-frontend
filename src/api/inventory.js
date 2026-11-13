import { apiRequest } from './client'
import { setCachedCatalogue, setCachedAlerts } from '../utils/offlineStore'

export async function listProducts({ includeInactive = false } = {}) {
  const query = includeInactive ? '?includeInactive=true' : ''
  const rows = await apiRequest(`/products${query}`)
  try {
    await setCachedCatalogue(rows)
  } catch {
    /* ignore */
  }
  return rows
}

export async function getProduct(id, options = {}) {
  const products = await listProducts({ includeInactive: true, ...options })
  return products.find((p) => p.id === id) || null
}

export async function saveProduct(payload) {
  return apiRequest('/products', {
    method: 'POST',
    body: {
      id: payload.id || undefined,
      name: payload.name,
      genericName: payload.genericName,
      category: payload.category,
      unit: payload.unit,
      costPrice: payload.costPrice,
      sellingPrice: payload.sellingPrice,
      reorderLevel: payload.reorderLevel,
      prescriptionOnly: payload.prescriptionOnly,
      active: payload.active,
    },
  })
}

export async function importProductsBulk(products) {
  return apiRequest('/products/bulk', {
    method: 'POST',
    body: {
      products: products.map((payload) => ({
        name: payload.name,
        genericName: payload.genericName,
        category: payload.category,
        unit: payload.unit,
        costPrice: payload.costPrice,
        sellingPrice: payload.sellingPrice,
        reorderLevel: payload.reorderLevel,
        prescriptionOnly: payload.prescriptionOnly,
        active: payload.active,
      })),
    },
  })
}

export async function restock(payload) {
  return apiRequest('/inventory/restock', {
    method: 'POST',
    body: {
      productId: payload.productId,
      batchNumber: payload.batchNumber,
      expiryDate: payload.expiryDate,
      quantity: Number(payload.quantity),
      costPrice: Number(payload.costPrice),
      supplier: payload.supplier || '',
    },
  })
}

export async function adjustStock(payload) {
  return apiRequest('/inventory/adjustments', {
    method: 'POST',
    body: {
      batchId: payload.batchId,
      newQuantity: Number(payload.newQuantity),
      reason: payload.reason,
    },
  })
}

export async function getStockAlerts() {
  const alerts = await apiRequest('/inventory/alerts')
  try {
    await setCachedAlerts(alerts)
  } catch {
    /* ignore */
  }
  return alerts
}
