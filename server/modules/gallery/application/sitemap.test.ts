import { describe, expect, it, vi } from 'vitest'
import { publishSitemap, readSitemap, type SitemapStore } from './sitemap'

const SITE = 'https://legendaryshots.gg'

function setup() {
  const stored = new Map<string, string>()
  const store: SitemapStore = {
    put: async (name, xml) => void stored.set(name, xml),
    read: async (name) => stored.get(name) ?? null,
  }
  const entries = vi.fn(async () => [{ path: '/v/wow-forever' }, { path: '/p/0193' }])
  const deps = { repo: { sitemapEntries: entries }, store, siteUrl: SITE }
  return { stored, entries, publish: publishSitemap(deps), read: readSitemap(deps) }
}

describe('sitemap', () => {
  it('US-25.2 the daily cron stores the index and its batches, the home first', async () => {
    const s = setup()
    expect(await s.publish()).toBe(2)
    expect([...s.stored.keys()]).toEqual(['sitemap.xml', 'sitemap-1.xml'])
    expect(s.stored.get('sitemap-1.xml')).toContain(
      `<url><loc>${SITE}/</loc></url><url><loc>${SITE}/v/wow-forever</loc></url>`,
    )
  })

  it('US-25.2 serves the stored files, and builds them when the cron has not run yet', async () => {
    const s = setup()
    await s.publish()
    s.stored.set('sitemap.xml', 'stored')
    s.entries.mockClear()
    expect(await s.read('sitemap.xml')).toBe('stored')
    expect(s.entries).not.toHaveBeenCalled()
    s.stored.clear()
    expect(await s.read('sitemap-1.xml')).toContain(`${SITE}/p/0193`)
    expect(s.stored.size).toBe(0) // the cron alone writes
  })

  it('finds no other file, nor a batch beyond the last', async () => {
    const s = setup()
    expect(await s.read('sitemap-2.xml')).toBeNull()
    expect(await s.read('feed.xml')).toBeNull()
    expect(s.entries).toHaveBeenCalledOnce() // the unknown name is refused before any read
  })
})
