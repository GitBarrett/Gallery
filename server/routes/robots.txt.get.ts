// robots.txt (US-25.4): the private areas left out, in both languages, and the sitemap; a preview refuses every robot
// (it also answers `X-Robots-Tag: noindex`, server/middleware/noindex.ts).
const PRIVATE = ['/admin', '/settings', '/api', '/upload']

export default defineEventHandler((event) => {
  const { deployEnv, siteUrl } = event.context.container.config
  const rules =
    deployEnv === 'preview'
      ? ['Disallow: /']
      : [...PRIVATE, ...PRIVATE.filter((p) => p !== '/api').map((p) => `/fr${p}`)].map((p) => `Disallow: ${p}`)
  setResponseHeaders(event, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' })
  return [
    'User-agent: *',
    ...rules,
    ...(deployEnv === 'preview' ? [] : ['', `Sitemap: ${siteUrl}/sitemap.xml`]),
    '',
  ].join('\n')
})
