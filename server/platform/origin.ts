const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF protection (08-securite.md § 5): a mutation is accepted only if the browser proves it comes from
 * the site itself, through `Sec-Fetch-Site: same-origin` or an `Origin` header equal to the site's origin.
 */
export function isAllowedRequest(
  request: { method: string; origin?: string | null; secFetchSite?: string | null },
  siteUrl: string,
): boolean {
  if (READS.has(request.method.toUpperCase())) return true
  if (request.secFetchSite === 'same-origin') return true
  return request.origin === new URL(siteUrl).origin
}
