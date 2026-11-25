import { api } from '~/services/api'

/** Game versions of the catalogue, not archived, in their display order (US-20), shared by the page under one key. */
export async function useGameVersions() {
  // During SSR, forwards the visitor's cookies (Cloudflare Access on previews): plain $fetch drops them
  const fetch = useRequestFetch()
  const { data } = await useAsyncData('game-versions', () => api.gameVersions(fetch))
  return computed(() => data.value?.versions ?? [])
}
