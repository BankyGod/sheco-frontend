/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const SYNC_TAG = 'sheco-sales-sync'

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'SHECO_SYNC', tag: SYNC_TAG })
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(notifyClientsToSync())
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHECO_REQUEST_SYNC') {
    event.waitUntil(notifyClientsToSync())
  }
})
