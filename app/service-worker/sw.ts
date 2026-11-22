/// <reference lib="webworker" />
// Service worker (ADR-008, injectManifest): precached shell and offline pages, then the rules of ./rules.ts.
// A new version waits for the user: skipWaiting only on the update toast's Reload (US-65, SKIP_WAITING message).
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import { cacheRule, offlinePage } from './rules'

declare const self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
  // Sign-out (US-64.4): no page or public read of the previous member stays on a shared device
  if (event.data?.type === 'CLEAR_USER_CACHES')
    event.waitUntil(Promise.all(['pages', 'api-public'].map((name) => caches.delete(name))))
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const DAY = 24 * 60 * 60
const ruleOf = ({ url, request }: { url: URL; request: Request }) =>
  cacheRule(url, { method: request.method, mode: request.mode, sameOrigin: url.origin === self.location.origin })

registerRoute(
  (options) => ruleOf(options) === 'pages',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * DAY })],
  }),
)
registerRoute(
  (options) => ruleOf(options) === 'api-public',
  new StaleWhileRevalidate({
    cacheName: 'api-public',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: DAY })],
  }),
)
// Private pages: network only, but still the offline page rather than the browser error
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  new NetworkOnly(),
)

setCatchHandler(async ({ request, url }) =>
  request.mode === 'navigate'
    ? ((await matchPrecache(offlinePage(url.pathname))) ?? Response.error())
    : Response.error(),
)
