import { describe, expect, it, vi } from 'vitest'
import { cloudflareCachePurger } from './cloudflare-cache-purger'

const urls = ['https://legendaryshots.gg/img/a/400', 'https://legendaryshots.gg/img/a/og.jpg']
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('cloudflareCachePurger', () => {
  it('purges the given URLs of the zone with the purge-only token', async () => {
    const fetch = reply({ success: true, result: { id: 'p1' } })
    await cloudflareCachePurger({ token: 'tok', zoneId: 'zone1', fetch }).purge(urls)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/zones/zone1/purge_cache')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toEqual({ files: urls })
  })

  it('does nothing without the token or the zone (previews: no edge cache)', async () => {
    const fetch = reply({ success: true })
    await cloudflareCachePurger({ zoneId: 'zone1', fetch }).purge(urls)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws when Cloudflare refuses, so the caller retries', async () => {
    await expect(
      cloudflareCachePurger({ token: 't', zoneId: 'z', fetch: reply({ success: false }, 403) }).purge(urls),
    ).rejects.toThrow('cache purge failed (403)')
  })
})
