// Service worker caching rules (03-architecture.md § PWA), pure so that they are unit tested. Display images
// (/img) get their rule in T-25b; anything not listed goes to the network (analytics, OAuth, Turnstile, R2…).
export type CacheRule = 'pages' | 'api-public' | 'network'

// Private pages and OAuth navigations, with or without the /fr prefix: never cached
const PRIVATE_PAGE = /^(\/fr)?\/(settings|admin|notifications|upload|auth|oauth)(\/|$)/
// Public API reads (lists, photo page, profiles, search, home, public settings, leaderboard)
const PUBLIC_API = /^\/api\/(photos|users|game-versions|search|home|settings\/public|leaderboard)(\/|$)/
// Not part of the app: Storybook (ADR-019), test routes
const OUTSIDE_APP = /^\/(storybook|__test)(\/|$)/

export function cacheRule(url: URL, request: { method: string; mode: string; sameOrigin: boolean }): CacheRule {
  if (!request.sameOrigin || request.method !== 'GET' || OUTSIDE_APP.test(url.pathname)) return 'network'
  if (request.mode === 'navigate') return PRIVATE_PAGE.test(url.pathname) ? 'network' : 'pages'
  return PUBLIC_API.test(url.pathname) ? 'api-public' : 'network'
}

/** Offline page in the language of the URL (French under /fr). */
export const offlinePage = (pathname: string) => (/^\/fr(\/|$)/.test(pathname) ? '/fr/offline' : '/offline')

export const OFFLINE_PAGES = ['/offline', '/fr/offline']
