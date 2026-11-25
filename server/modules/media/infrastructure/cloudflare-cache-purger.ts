import { z } from 'zod'
import type { CachePurger } from '../application/ports'

// Purge by URL of the zone's cache (03 § Configuration: `CF_API_TOKEN_PURGE`, Cache Purge permission only, and
// `CF_ZONE_ID`). Without them (previews on workers.dev, which have no edge cache), there is nothing to purge.
const Answer = z.object({ success: z.boolean() })

export const cloudflareCachePurger = (deps: {
  token?: string
  zoneId?: string
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}): CachePurger => ({
  async purge(urls) {
    if (!deps.token || !deps.zoneId) return
    const response = await deps.fetch(`https://api.cloudflare.com/client/v4/zones/${deps.zoneId}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${deps.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files: urls }),
      signal: AbortSignal.timeout(10_000),
    })
    const answer = Answer.safeParse(await response.json().catch(() => null))
    if (!response.ok || !answer.success || !answer.data.success)
      throw new Error(`cache purge failed (${response.status})`)
  },
})
