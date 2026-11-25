import { z } from 'zod'

type EdgeCache = {
  match(url: string): Promise<Response | undefined>
  put(url: string, response: Response): Promise<void>
}
const edgeCache = () => (globalThis as { caches?: { default?: EdgeCache } }).caches?.default
const notFound = () => new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })

// Avatar of a member (US-07.6, 03 § Pipeline image): /avatar/{userId}/{version}/{64|128|256}, the version shown
// only; a new avatar changes the URL, so a month of immutable cache, at the edge too.
export default defineEventHandler(async (event) => {
  const userId = z.uuid().safeParse(getRouterParam(event, 'userId'))
  const version = z.uuid().safeParse(getRouterParam(event, 'version'))
  if (!userId.success || !version.success) return notFound()
  const url = getRequestURL(event).href
  const cache = edgeCache()
  const hit = await cache?.match(url)
  if (hit) return hit
  const body = await event.context.container.media.serveAvatar({
    userId: userId.data,
    version: version.data,
    size: getRouterParam(event, 'size')!,
  })
  if (!body) return notFound()
  const response = new Response(body, {
    headers: {
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=2592000, immutable',
    },
  })
  if (cache) event.waitUntil(cache.put(url, response.clone()))
  return response
})
