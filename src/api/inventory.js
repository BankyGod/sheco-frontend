import { addAudit, getStore, nextId } from '../data/mockStore'

function isExpired(batch, asOf = new Date()) {
  return new Date(batch.expiryDate) < new Date(asOf.toISOString().slice(0, 10))
}

function daysUntilExpiry(batch) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(batch.expiryDate)
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
}

export function getSellableQuantity(productId) {
  const { batches } = getStore()
  return batches
    .filter((b) => b.productId === productId && !isExpired(b) && b.quantityRemaining > 0)
    .reduce((sum, b) => sum + b.quantityRemaining, 0)
}

export function getAvailableBatches(productId) {
  const { batches } = getStore()
  return batches
    .filter((b) => b.productId === productId && !isExpired(b) && b.quantityRemaining > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
}

export function listProducts({ includeInactive = false, forSalesperson = false } = {}) {
  const { products, batches, settings } = getStore()
  return products
    .filter((p) => includeInactive || p.active)
    .map((p) => {
      const productBatches = batches.filter((b) => b.productId === p.id)
      const availableQty = getSellableQuantity(p.id)
      const totalQty = productBatches.reduce((s, b) => s + b.quantityRemaining, 0)
      const lowStock = availableQty <= p.reorderLevel
      const expiringSoon = productBatches.some(
        (b) =>
          !isExpired(b) &&
          b.quantityRemaining > 0 &&
          daysUntilExpiry(b) <= settings.expiryAlertDays,
      )
      const expiredQty = productBatches
        .filter((b) => isExpired(b))
        .reduce((s, b) => s + b.quantityRemaining, 0)

      const unitProfit = (p.sellingPrice || 0) - (p.costPrice || 0)
      const base = {
        ...p,
        availableQty,
        totalQty,
        lowStock,
        expiringSoon,
        expiredQty,
        unitProfit,
      }

      if (forSalesperson) {
        const { costPrice, unitProfit: _profit, batches: _batches, ...safe } = base
        void costPrice
        void _profit
        void _batches
        return safe
      }
      return {
        ...base,
        batches: productBatches.map((b) => ({
          ...b,
          expired: isExpired(b),
          daysToExpiry: daysUntilExpiry(b),
        })),
      }
    })
}

export function getProduct(id, { forSalesperson = false } = {}) {
  return listProducts({ includeInactive: true, forSalesperson }).find((p) => p.id === id)
}

export function saveProduct(payload, actor) {
  const store = getStore()
  if (payload.id) {
    const idx = store.products.findIndex((p) => p.id === payload.id)
    if (idx === -1) throw new Error('Product not found')
    const prev = store.products[idx]
    store.products[idx] = { ...prev, ...payload }
    if (
      prev.sellingPrice !== payload.sellingPrice ||
      prev.costPrice !== payload.costPrice
    ) {
      addAudit({
        userId: actor.id,
        deviceId: actor.deviceId,
        action: 'price_change',
        record: `${payload.name} cost/selling price updated`,
      })
    } else {
      addAudit({
        userId: actor.id,
        deviceId: actor.deviceId,
        action: 'product_update',
        record: `Updated product ${payload.name}`,
      })
    }
    return store.products[idx]
  }

  const product = {
    id: nextId('p'),
    active: true,
    ...payload,
  }
  store.products.push(product)
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'product_create',
    record: `Created product ${product.name}`,
  })
  return product
}

export function restock({ productId, batchNumber, expiryDate, quantity, costPrice, supplier }, actor) {
  const store = getStore()
  const batch = {
    id: nextId('b'),
    productId,
    batchNumber,
    expiryDate,
    quantityReceived: Number(quantity),
    quantityRemaining: Number(quantity),
    costPrice: Number(costPrice),
    supplier,
    dateReceived: new Date().toISOString().slice(0, 10),
  }
  store.batches.push(batch)
  const product = store.products.find((p) => p.id === productId)
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'restock',
    record: `Restocked ${product?.name || productId} batch ${batchNumber} (+${quantity})`,
  })
  return batch
}

export function adjustStock({ batchId, newQuantity, reason }, actor) {
  const store = getStore()
  const batch = store.batches.find((b) => b.id === batchId)
  if (!batch) throw new Error('Batch not found')
  const oldQty = batch.quantityRemaining
  batch.quantityRemaining = Number(newQuantity)
  const product = store.products.find((p) => p.id === batch.productId)
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'stock_adjustment',
    record: `Adjusted ${product?.name || batch.productId} batch ${batch.batchNumber}: ${oldQty} → ${newQuantity}. Reason: ${reason}`,
  })
  return batch
}

export function getStockAlerts() {
  const { products, batches, settings } = getStore()
  const lowStock = []
  const expiringSoon = []
  const expired = []

  for (const product of products.filter((p) => p.active)) {
    const availableQty = getSellableQuantity(product.id)
    if (availableQty <= product.reorderLevel) {
      lowStock.push({ product, availableQty })
    }
    for (const batch of batches.filter((b) => b.productId === product.id && b.quantityRemaining > 0)) {
      if (isExpired(batch)) {
        expired.push({ product, batch })
      } else if (daysUntilExpiry(batch) <= settings.expiryAlertDays) {
        expiringSoon.push({
          product,
          batch,
          daysToExpiry: daysUntilExpiry(batch),
        })
      }
    }
  }

  return { lowStock, expiringSoon, expired }
}

export function allocateBatchesForSale(productId, quantity) {
  const batches = getAvailableBatches(productId)
  let remaining = quantity
  const allocations = []

  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantityRemaining, remaining)
    allocations.push({
      batchId: batch.id,
      quantity: take,
      unitCostPrice: batch.costPrice,
    })
    remaining -= take
  }

  if (remaining > 0) {
    throw new Error('Insufficient sellable stock (expired batches are excluded)')
  }
  return allocations
}

export function deductAllocations(allocations) {
  const store = getStore()
  for (const alloc of allocations) {
    const batch = store.batches.find((b) => b.id === alloc.batchId)
    if (!batch || batch.quantityRemaining < alloc.quantity) {
      throw new Error('Stock changed during sale')
    }
    batch.quantityRemaining -= alloc.quantity
  }
}

export function restoreAllocations(items) {
  const store = getStore()
  for (const item of items) {
    const batch = store.batches.find((b) => b.id === item.batchId)
    if (batch) batch.quantityRemaining += item.quantity
  }
}
