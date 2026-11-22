/// <reference lib="webworker" />
// Service worker (ADR-008, injectManifest): precached shell and offline pages, then the rules of ./rules.ts.
// No skipWaiting here: the new version waits for the user (update toast, T-09b).
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import { cacheRule, offlinePage } from './rules'

declare const self: ServiceWorkerGlobalScope

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
