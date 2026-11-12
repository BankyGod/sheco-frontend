/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA offline shell: any app navigation serves index.html from cache
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/health$/, /^\/assets\//],
  }),
)

// Images used by the UI (login background, icons)
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' ||
    /\.(?:png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'sheco-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
)

// Optional: keep a short-lived copy of successful GET API responses for soft offline reads
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'sheco-api-get',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 12 }),
    ],
  }),
)

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
