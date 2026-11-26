import type { SearchResponse } from '~~/shared/contracts/photos'
import { api, ApiError, errorMessageKey } from '~/services/api'
import type { GridCapture } from '~/features/gallery/useGalleryFeed'
import { writeSearch, type Search } from './query'

/**
 * Results of a search (US-21): the first page rendered by the server and read again when the search changes, the next
 * ones loaded on demand by their cursor. No text: nothing is asked. `found` is false for an unknown or archived
 * version (404).
 */
export async function useSearch(search: Ref<Search>) {
  const fetch = useRequestFetch() // during SSR, forwards the visitor's cookies (Cloudflare Access on previews)
  // The API query: the URL names the minimum quality `quality`, the API `minQuality`
  const asked = computed(() => ({ ...search.value, q: search.value.q.trim() }))
  const { data, error: failed } = await useAsyncData(
    () => `search:${JSON.stringify(writeSearch(search.value))}`,
    (): Promise<SearchResponse | 'none' | null> =>
      asked.value.q
        ? api.search(asked.value, fetch).catch((error) => {
            if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
            throw error
          })
        : Promise.resolve('none'),
  )
  const page = computed(() => (data.value && data.value !== 'none' ? data.value : undefined))
  const more = ref<GridCapture[]>([])
  const next = ref(page.value?.nextCursor ?? null)
  watch(page, (current) => {
    more.value = []
    next.value = current?.nextCursor ?? null
  })
  const loading = ref(false)
  /** i18n key of the error of the last page asked, translated by the page. */
  const error = ref<string>()

  async function loadMore() {
    if (!next.value || loading.value) return
    loading.value = true
    error.value = undefined
    try {
      const nextPage = await api.search({ ...asked.value, cursor: next.value })
      more.value.push(...nextPage.items)
      next.value = nextPage.nextCursor
    } catch (thrown) {
      error.value = errorMessageKey(thrown)
    } finally {
      loading.value = false
    }
  }

  return {
    found: computed(() => data.value !== null),
    failed: computed(() => Boolean(failed.value)),
    /** The query as searched, the name searched instead of a typo, what to offer when nothing is found. */
    page,
    captures: computed(() => [...(page.value?.items ?? []), ...more.value]),
    done: computed(() => !next.value),
    loading,
    error,
    loadMore,
  }
}
