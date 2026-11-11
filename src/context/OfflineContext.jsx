import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getQueuedSales, syncQueuedSales } from '../api/sales'
import { getStoredSession } from '../api/client'
import {
  exportQueueJson,
  getCachedCatalogue as readCatalogue,
  migrateLegacyOfflineData,
  requestBackgroundSync,
  setCachedCatalogue as writeCatalogue,
  SYNC_TAG,
} from '../utils/offlineStore'

const OfflineContext = createContext(null)

function catalogueAgeLabel(savedAt) {
  if (!savedAt) return 'Never'
  const ms = Date.now() - new Date(savedAt).getTime()
  if (Number.isNaN(ms) || ms < 0) return new Date(savedAt).toLocaleString()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [queueCount, setQueueCount] = useState(0)
  const [queuedSales, setQueuedSales] = useState([])
  const [lastSyncMessage, setLastSyncMessage] = useState('')
  const [catalogueMeta, setCatalogueMeta] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const refreshQueue = useCallback(async () => {
    const rows = await getQueuedSales()
    setQueuedSales(rows)
    setQueueCount(rows.length)
    return rows
  }, [])

  const refreshCatalogueMeta = useCallback(async () => {
    const cached = await readCatalogue()
    setCatalogueMeta(cached)
    return cached
  }, [])

  const cacheCatalogue = useCallback(async (products) => {
    const savedAt = new Date().toISOString()
    await writeCatalogue(products, savedAt)
    const next = { savedAt, products }
    setCatalogueMeta(next)
    return next
  }, [])

  const getCachedCatalogue = useCallback(async () => {
    const cached = await readCatalogue()
    setCatalogueMeta(cached)
    return cached
  }, [])

  const syncNow = useCallback(async () => {
    if (syncing) return { synced: 0, blocked: 'busy' }
    setSyncing(true)
    try {
      if (!navigator.onLine) {
        setLastSyncMessage('Still offline')
        return { synced: 0, blocked: 'offline', message: 'Still offline' }
      }
      const session = getStoredSession()
      if (!session?.accessToken || session?.offlineUnlock) {
        const rows = await refreshQueue()
        const message = rows.length
          ? `Sign in online to sync ${rows.length} queued sale(s)`
          : 'Sign in online to enable sync'
        setLastSyncMessage(message)
        return { synced: 0, blocked: 'auth', message, queueCount: rows.length }
      }

      const result = await syncQueuedSales()
      await refreshQueue()
      await refreshCatalogueMeta()
      setLastSyncMessage(result.message || 'Sync finished')
      if (result.synced > 0 || result.alreadyExists > 0) {
        window.dispatchEvent(new CustomEvent('sheco:synced', { detail: result }))
      }
      return result
    } catch (err) {
      const message = err.message || 'Sync failed'
      setLastSyncMessage(message)
      return { synced: 0, failed: 1, message }
    } finally {
      setSyncing(false)
    }
  }, [refreshCatalogueMeta, refreshQueue, syncing])

  const exportQueue = useCallback(async () => {
    const rows = await refreshQueue()
    if (!rows.length) {
      setLastSyncMessage('No unsynced sales to export')
      return false
    }
    exportQueueJson(rows)
    setLastSyncMessage(`Exported ${rows.length} unsynced sale(s)`)
    return true
  }, [refreshQueue])

  useEffect(() => {
    let active = true
    ;(async () => {
      await migrateLegacyOfflineData()
      if (!active) return
      await refreshQueue()
      await refreshCatalogueMeta()
      await requestBackgroundSync()
    })()
    return () => {
      active = false
    }
  }, [refreshCatalogueMeta, refreshQueue])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      syncNow()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncNow])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    function onMessage(event) {
      if (event.data?.type === 'SHECO_SYNC' || event.data?.tag === SYNC_TAG) {
        syncNow()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [syncNow])

  const value = useMemo(
    () => ({
      online,
      queueCount,
      queuedSales,
      lastSyncMessage,
      syncing,
      catalogueMeta,
      catalogueAgeLabel: catalogueAgeLabel(catalogueMeta?.savedAt),
      refreshQueue,
      syncNow,
      exportQueue,
      cacheCatalogue,
      getCachedCatalogue,
    }),
    [
      online,
      queueCount,
      queuedSales,
      lastSyncMessage,
      syncing,
      catalogueMeta,
      refreshQueue,
      syncNow,
      exportQueue,
      cacheCatalogue,
      getCachedCatalogue,
    ],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
