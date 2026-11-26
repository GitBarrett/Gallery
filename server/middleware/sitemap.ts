// Sitemap (US-25.2): `/sitemap.xml`, the index, and its batches `/sitemap-{n}.xml`, rebuilt by the daily cron; public,
// cached an hour at the edge (03 § SEO). A middleware: a file route `[name].xml` would catch every one-segment path.
const PATH = /^\/sitemap(-[1-9]\d*)?\.xml$/

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!PATH.test(path) || event.method !== 'GET') return
  const xml = await event.context.container.gallery.readSitemap(path.slice(1))
  if (xml === null) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
  setResponseHeaders(event, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  })
  return xml
})
