// Path of the site only (08-securite.md § 3): `//host`, `/\host` and their encoded forms open another site.
const SITE_PATH = /^\/(?![/\\])[^\\]*$/

/** The `redirect` query of the sign-in page when it stays on the site, `/` otherwise (US-03.6). */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !SITE_PATH.test(value)) return '/'
  try {
    return SITE_PATH.test(decodeURIComponent(value)) ? value : '/'
  } catch {
    return '/' // malformed escape
  }
}
