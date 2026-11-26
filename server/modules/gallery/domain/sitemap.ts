/** URLs per file of the sitemap (US-25.2, sitemaps.org allows 50 000). */
export const SITEMAP_BATCH = 10_000

export interface SitemapEntry {
  /** Path of the site, `/p/{id}` */
  path: string
  lastmod?: Date
}

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
const RESERVED: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }
const escape = (text: string) => text.replace(/[&<>'"]/g, (c) => RESERVED[c]!)

/** `sitemap.xml` (the index) and `sitemap-{n}.xml` (the batches, from 1). */
export const isSitemapName = (name: string) => /^sitemap(-[1-9]\d*)?\.xml$/.test(name)

/**
 * The files of the sitemap (sitemaps.org): `sitemap.xml`, an index of `sitemap-1.xml`, `sitemap-2.xml`…, each with
 * `batch` URLs at most and their last modification day.
 */
export function sitemapFiles(entries: SitemapEntry[], siteUrl: string, batch = SITEMAP_BATCH): Map<string, string> {
  const files = new Map<string, string>()
  const names: string[] = []
  for (let start = 0; start < Math.max(entries.length, 1); start += batch) {
    const urls = entries.slice(start, start + batch).map(({ path, lastmod }) => {
      const day = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
      return `<url><loc>${escape(siteUrl + path)}</loc>${day}</url>`
    })
    const name = `sitemap-${names.length + 1}.xml`
    names.push(name)
    files.set(name, `${HEAD}<urlset ${NS}>${urls.join('')}</urlset>\n`)
  }
  const index = names.map((name) => `<sitemap><loc>${escape(`${siteUrl}/${name}`)}</loc></sitemap>`).join('')
  return new Map([['sitemap.xml', `${HEAD}<sitemapindex ${NS}>${index}</sitemapindex>\n`], ...files])
}
