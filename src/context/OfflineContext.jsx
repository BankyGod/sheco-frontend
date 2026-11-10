import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getQueuedSales, syncQueuedSales } from '../api/sales'

const OfflineContext = createContext(null)
const CATALOGUE_KEY = 'sheco_catalogue_cache'

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [queueCount, setQueueCount] = useState(() => getQueuedSales().length)
  const [lastSyncMessage, setLastSyncMessage] = useState('')

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      const result = syncQueuedSales()
      setQueueCount(getQueuedSales().length)
      if (result.synced > 0) {
        setLastSyncMessage(`Synced ${result.synced} offline sale(s)`)
      }
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const value = useMemo(
    () => ({
      online,
      queueCount,
      lastSyncMessage,
      refreshQueue() {
        setQueueCount(getQueuedSales().length)
      },
      cacheCatalogue(products) {
        localStorage.setItem(
          CATALOGUE_KEY,
          JSON.stringify({ savedAt: new Date().toISOString(), products }),
        )
      },
      getCachedCatalogue() {
        try {
          return JSON.parse(localStorage.getItem(CATALOGUE_KEY) || 'null')
        } catch {
          return null
        }
      },
      syncNow() {
        if (!navigator.onLine) {
          setLastSyncMessage('Still offline')
          return { synced: 0 }
        }
        const result = syncQueuedSales()
        setQueueCount(getQueuedSales().length)
        setLastSyncMessage(
          result.synced > 0 ? `Synced ${result.synced} offline sale(s)` : 'Nothing to sync',
        )
        return result
      },
    }),
    [online, queueCount, lastSyncMessage],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
