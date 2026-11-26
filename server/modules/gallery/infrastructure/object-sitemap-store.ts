import type { ObjectStorage } from '../../media'
import type { SitemapStore } from '../application/sitemap'

/** The sitemap in the private bucket, under `sitemap/` (with the preview prefix of the storage, ADR-013). */
export function objectSitemapStore(storage: ObjectStorage): SitemapStore {
  return {
    async put(name, xml) {
      const bytes = new TextEncoder().encode(xml)
      await storage.put(`sitemap/${name}`, bytes, { bytes: bytes.length, contentType: 'application/xml' })
    },
    async read(name) {
      const body = await storage.read(`sitemap/${name}`)
      return body && new Response(body).text()
    },
  }
}
