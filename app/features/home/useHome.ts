import { api } from '~/services/api'

/**
 * The home (US-24, US-70.4), read during SSR with the visitor's cookies (Cloudflare Access on previews); null on
 * error: the page then shows its hero without image and no block, never an empty one.
 */
export async function useHome() {
  const fetch = useRequestFetch()
  const { data } = await useAsyncData('home', () => api.home(fetch).catch(() => null))
  return computed(() => data.value ?? null)
}
