import { api, errorMessageKey } from '~/services/api'
import type { GridCapture } from '~/features/gallery/useGalleryFeed'

/**
 * Public captures of a profile (US-05.3): the first page rendered by the server, the next ones on demand by their
 * cursor, until the last.
 */
export async function useProfileCaptures(username: string) {
  const fetch = useRequestFetch() // during SSR, forwards the visitor's cookies (Cloudflare Access on previews)
  const { data } = await useAsyncData(`profile-captures:${username.toLowerCase()}`, () =>
    api.userPhotos(username, undefined, fetch).catch(() => ({ items: [], nextCursor: null })),
  )
  const more = ref<GridCapture[]>([])
  const next = ref(data.value?.nextCursor ?? null)
  const loading = ref(false)
  /** i18n key of the error of the last page asked. */
  const error = ref<string>()

  async function loadMore() {
    if (!next.value || loading.value) return
    loading.value = true
    error.value = undefined
    try {
      const page = await api.userPhotos(username, next.value)
      more.value.push(...page.items)
      next.value = page.nextCursor
    } catch (thrown) {
      error.value = errorMessageKey(thrown)
    } finally {
      loading.value = false
    }
  }

  return {
    captures: computed(() => [...(data.value?.items ?? []), ...more.value]),
    done: computed(() => !next.value),
    loading,
    error,
    loadMore,
  }
}
