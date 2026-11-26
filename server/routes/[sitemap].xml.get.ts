// Sitemap (US-25.2): `/sitemap.xml`, the index, and its batches `/sitemap-{n}.xml`, rebuilt by the daily cron; public,
// cached an hour at the edge (03 § SEO). Any other `.xml` is not found.
export default defineEventHandler(async (event) => {
  const name = getRequestURL(event).pathname.slice(1) // checked by readSitemap
  const xml = await event.context.container.gallery.readSitemap(name)
  if (xml === null) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
  setResponseHeaders(event, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  })
  return xml
})
