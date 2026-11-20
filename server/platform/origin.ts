const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Protection CSRF (08-securite.md § 5) : une mutation n'est acceptée que si le navigateur prouve qu'elle vient
 * du site lui-même, par `Sec-Fetch-Site: same-origin` ou un en-tête `Origin` identique à l'origine du site.
 */
export function isAllowedRequest(
  request: { method: string; origin?: string | null; secFetchSite?: string | null },
  siteUrl: string,
): boolean {
  if (READS.has(request.method.toUpperCase())) return true
  if (request.secFetchSite === 'same-origin') return true
  return request.origin === new URL(siteUrl).origin
}
