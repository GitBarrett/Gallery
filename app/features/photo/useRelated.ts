import { api } from '~/services/api'

/**
 * Previous / next captures and the « More from » block of a photo page (US-67.2, US-70.1, US-70.2), read during SSR
 * with the visitor's cookies (Cloudflare Access on previews); null when unknown or on error: the page shows no
 * navigation then, never an empty block.
 */
export async function useRelated(id: string) {
  const fetch = useRequestFetch()
  const { data } = await useAsyncData(`related:${id}`, () => api.related(id, fetch).catch(() => null))
  return computed(() => data.value ?? null)
}
