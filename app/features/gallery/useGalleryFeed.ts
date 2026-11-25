import type { PhotosResponse } from '~~/shared/contracts/photos'
import { api, ApiError, errorMessageKey } from '~/services/api'

export type GridCapture = PhotosResponse['items'][number]

/**
 * Published captures of a game version (US-20.1, US-20.2): the first page rendered by the server, the next ones
 * loaded on demand by their cursor, until the last. `found` is false for an unknown or archived version (404).
 */
export async function useGalleryFeed(version: string) {
  const fetch = useRequestFetch() // during SSR, forwards the visitor's cookies (Cloudflare Access on previews)
  const { data, error: failed } = await useAsyncData(`gallery:${version}`, () =>
    api.photos({ version }, fetch).catch((error) => {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
      throw error
    }),
  )
  const more = ref<GridCapture[]>([])
  const next = ref(data.value?.nextCursor ?? null)
  const loading = ref(false)
  /** i18n key of the error of the last page asked, translated by the page. */
  const error = ref<string>()

  async function loadMore() {
    if (!next.value || loading.value) return
    loading.value = true
    error.value = undefined
    try {
      const page = await api.photos({ version, cursor: next.value })
      more.value.push(...page.items)
      next.value = page.nextCursor
    } catch (thrown) {
      error.value = errorMessageKey(thrown)
    } finally {
      loading.value = false
    }
  }

  return {
    found: computed(() => data.value !== null),
    /** The first page could not be read (other than not found): the page shows the error page. */
    failed: computed(() => Boolean(failed.value)),
    captures: computed(() => [...(data.value?.items ?? []), ...more.value]),
    done: computed(() => !next.value),
    loading,
    error,
    loadMore,
  }
}
