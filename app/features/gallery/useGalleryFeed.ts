import type { PhotosResponse } from '~~/shared/contracts/photos'
import { api, ApiError, errorMessageKey } from '~/services/api'
import type { GalleryFilters } from './filters'

export type GridCapture = PhotosResponse['items'][number]

const NOTHING = { items: [], nextCursor: null }

/**
 * Published captures of a game version (US-20.1 to US-20.3): the first page rendered by the server and read again
 * when the filters change, the next ones loaded on demand by their cursor, until the last. `found` is false for an
 * unknown or archived version (404); a zone that is no more in the dictionary matches nothing.
 */
export async function useGalleryFeed(version: string, filters: Ref<GalleryFilters> = ref({})) {
  const fetch = useRequestFetch() // during SSR, forwards the visitor's cookies (Cloudflare Access on previews)
  const { data, error: failed } = await useAsyncData(
    () => `gallery:${version}:${JSON.stringify(filters.value)}`,
    () =>
      api.photos({ version, ...filters.value }, fetch).catch((error) => {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
        if (error instanceof ApiError && error.details?.field === 'zone') return NOTHING
        throw error
      }),
  )
  const more = ref<GridCapture[]>([])
  const next = ref(data.value?.nextCursor ?? null)
  watch(data, (page) => {
    more.value = []
    next.value = page?.nextCursor ?? null
  })
  const loading = ref(false)
  /** i18n key of the error of the last page asked, translated by the page. */
  const error = ref<string>()

  async function loadMore() {
    if (!next.value || loading.value) return
    loading.value = true
    error.value = undefined
    try {
      const page = await api.photos({ version, ...filters.value, cursor: next.value })
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
    /** The page of the current filters could not be read (other than not found). */
    failed: computed(() => Boolean(failed.value)),
    captures: computed(() => [...(data.value?.items ?? []), ...more.value]),
    done: computed(() => !next.value),
    loading,
    error,
    loadMore,
  }
}
