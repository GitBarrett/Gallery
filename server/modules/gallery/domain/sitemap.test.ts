import { describe, expect, it } from 'vitest'
import { isSitemapName, sitemapFiles } from './sitemap'

const SITE = 'https://legendaryshots.gg'

describe('sitemapFiles', () => {
  it('US-25.2 writes an index of the batches, each with its URLs and their last modification', () => {
    const files = sitemapFiles(
      [{ path: '/' }, { path: '/v/wow-forever' }, { path: '/p/0193', lastmod: new Date('2026-11-25T10:00:00Z') }],
      SITE,
      2,
    )
    expect([...files.keys()]).toEqual(['sitemap.xml', 'sitemap-1.xml', 'sitemap-2.xml'])
    expect(files.get('sitemap.xml')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        `<sitemap><loc>${SITE}/sitemap-1.xml</loc></sitemap>` +
        `<sitemap><loc>${SITE}/sitemap-2.xml</loc></sitemap>` +
        '</sitemapindex>\n',
    )
    expect(files.get('sitemap-1.xml')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        `<url><loc>${SITE}/</loc></url><url><loc>${SITE}/v/wow-forever</loc></url>` +
        '</urlset>\n',
    )
    expect(files.get('sitemap-2.xml')).toContain(`<url><loc>${SITE}/p/0193</loc><lastmod>2026-11-25</lastmod></url>`)
  })

  it('US-25.2 cuts the batches at 10 000 URLs by default, and escapes what XML reserves', () => {
    const entries = Array.from({ length: 10_001 }, (_, n) => ({ path: `/p/${n}` }))
    const files = sitemapFiles(entries, SITE)
    expect(files.size).toBe(3)
    expect(files.get('sitemap-1.xml')!.match(/<url>/g)).toHaveLength(10_000)
    expect(sitemapFiles([{ path: '/u/a&b<\'">' }], SITE).get('sitemap-1.xml')).toContain(
      `<loc>${SITE}/u/a&amp;b&lt;&apos;&quot;&gt;</loc>`,
    )
  })

  it('names only the index and the batches', () => {
    for (const name of ['sitemap.xml', 'sitemap-1.xml', 'sitemap-42.xml']) expect(isSitemapName(name)).toBe(true)
    for (const name of ['sitemap-0.xml', 'sitemap-01.xml', 'feed.xml', 'sitemap-1.xml.gz', '../sitemap.xml'])
      expect(isSitemapName(name), name).toBe(false)
  })
})
