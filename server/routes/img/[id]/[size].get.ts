import { z } from 'zod'
import { getContext } from '../../../platform/auth-context'

type EdgeCache = { match(url: string): Promise<Response | undefined>; put(url: string, response: Response): Promise<void> }
// API Cache of the Worker (03 § Pipeline image 6), keyed by the exact URL; absent in Node and inactive on workers.dev
const edgeCache = () => (globalThis as { caches?: { default?: EdgeCache } }).caches?.default
const notFound = () => new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })

// Images of a capture (US-14.4, US-68.3): /img/{id}/{400|800|1200|2400} in WebP, /img/{id}/og.jpg. The session is
// read only for `?preview=1`: a public image never touches the database's sessions.
export default defineEventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) return notFound()
  const preview = getQuery(event).preview === '1'
  const url = getRequestURL(event).href
  const cache = preview ? undefined : edgeCache()
  const hit = await cache?.match(url)
  if (hit) return hit
  const { container, actor } = preview ? await getContext(event) : { container: event.context.container, actor: null }
  const served = await container.media.serveImage({ photoId: id.data, size: getRouterParam(event, 'size')!, preview, viewer: actor })
  if (!served.ok) return notFound()
  const response = new Response(served.value.body, {
    headers: {
      'content-type': served.value.contentType,
      'x-content-type-options': 'nosniff',
      'cache-control': served.value.public ? 'public, max-age=2592000, immutable' : 'private, no-store',
    },
  })
  if (cache && served.value.public) event.waitUntil(cache.put(url, response.clone()))
  return response
})
