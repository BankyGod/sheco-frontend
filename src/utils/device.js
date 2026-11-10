const DEVICE_KEY = 'sheco_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function createSaleId() {
  return `sale_${getDeviceId()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createReceiptNumber(seq) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${getDeviceId()}-${stamp}-${String(seq).padStart(4, '0')}`
}
