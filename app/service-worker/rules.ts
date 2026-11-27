// Service worker caching rules (03-architecture.md § PWA), pure so that they are unit tested; anything not listed
// goes to the network (analytics, OAuth, Turnstile, R2…).
export type CacheRule = 'pages' | 'api-public' | 'img' | 'network'

// Private pages and OAuth navigations, with or without the /fr prefix: never cached
const PRIVATE_PAGE = /^(\/fr)?\/(settings|admin|notifications|upload|my-captures|auth|oauth)(\/|$)/
// Public API reads (lists, photo page, profiles, search, home, public settings, leaderboard)
const PUBLIC_API = /^\/api\/(photos|users|game-versions|search|home|settings\/public|leaderboard)(\/|$)/
// …but what must be fresh under them: the member's like (US-30.1), the comments just posted (US-31.1)
const MEMBER_API = /^\/api\/photos\/[^/]+\/(like|comments)$/
// Display images up to 1200 px (US-64.1); never the 2400 px nor an original (US-64.5), nor a private preview
const CACHED_IMAGE = /^\/img\/[0-9a-f-]{36}\/(400|800|1200)$/
/** The `img` cache (US-64.6): the oldest image goes beyond 300, within the 50 MB budget. */
export const IMG_CACHE = { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }
// Not part of the app: Storybook (ADR-019), test routes
const OUTSIDE_APP = /^\/(storybook|__test)(\/|$)/

export function cacheRule(url: URL, request: { method: string; mode: string; sameOrigin: boolean }): CacheRule {
  if (!request.sameOrigin || request.method !== 'GET' || OUTSIDE_APP.test(url.pathname)) return 'network'
  if (request.mode === 'navigate') return PRIVATE_PAGE.test(url.pathname) ? 'network' : 'pages'
  if (CACHED_IMAGE.test(url.pathname) && !url.search) return 'img'
  return PUBLIC_API.test(url.pathname) && !MEMBER_API.test(url.pathname) ? 'api-public' : 'network'
}

/** Offline page in the language of the URL (French under /fr). */
export const offlinePage = (pathname: string) => (/^\/fr(\/|$)/.test(pathname) ? '/fr/offline' : '/offline')

export const OFFLINE_PAGES = ['/offline', '/fr/offline']
