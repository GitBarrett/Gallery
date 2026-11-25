import { api, ApiError } from '~/services/api'

/**
 * A published capture for its photo page (US-25.1), read during SSR so that robots get the page whole; null when
 * it is not public. During SSR it forwards the visitor's cookies (Cloudflare Access on previews).
 */
export async function usePhoto(id: string) {
  const fetch = useRequestFetch()
  const { data } = await useAsyncData(`photo:${id}`, () =>
    api.photo(id, fetch).catch((error) => {
      if (error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_FAILED')) return null
      throw error
    }),
  )
  return computed(() => data.value ?? null)
}
