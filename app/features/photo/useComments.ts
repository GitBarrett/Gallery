import type { CommentItem } from '~~/shared/contracts/comments'
import { api, ApiError, errorMessageKey } from '~/services/api'

/**
 * Comments of a photo page (US-31): the first page rendered by the server, the next ones on demand; a comment posted
 * shows at once at the top (US-31.1), an edit or a deletion changes the list in place. `count`: the counter shown.
 * `turnstile` becomes true when the server asks a Turnstile token (accounts of less than a day, US-31.5).
 */
export async function useComments(photoId: string, initialCount: number) {
  const fetch = useRequestFetch() // during SSR, forwards the visitor's cookies (Cloudflare Access on previews)
  const { data } = await useAsyncData(`comments:${photoId}`, () =>
    api.comments(photoId, undefined, fetch).catch(() => ({ items: [], nextCursor: null })),
  )
  const items = ref<CommentItem[]>([...(data.value?.items ?? [])])
  const next = ref(data.value?.nextCursor ?? null)
  // The photo answer is cached a minute, the list never: a complete list is the exact count
  const count = ref(next.value ? Math.max(initialCount, items.value.length) : items.value.length)
  const busy = ref(false)
  const turnstile = ref(false)
  /** i18n key of the last error, translated by the section. */
  const error = ref<string>()

  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    busy.value = true
    error.value = undefined
    try {
      return await work()
    } catch (thrown) {
      const field = thrown instanceof ApiError ? thrown.details?.field : undefined
      if (field === 'turnstileToken') turnstile.value = true
      if (field === 'turnstileToken') error.value = 'comments.errors.turnstile'
      else
        error.value =
          thrown instanceof ApiError && field === 'body'
            ? `comments.errors.${thrown.details?.reason}`
            : errorMessageKey(thrown)
    } finally {
      busy.value = false
    }
  }

  const post = (body: string, turnstileToken?: string) =>
    run(async () => {
      const comment = await api.postComment(photoId, { body, ...(turnstileToken ? { turnstileToken } : {}) })
      items.value = [comment, ...items.value]
      count.value++
      turnstile.value = false
      return comment
    })

  const edit = (id: string, body: string) =>
    run(async () => {
      const edited = await api.editComment(id, body)
      items.value = items.value.map((c) => (c.id === id ? { ...c, ...edited } : c))
      return edited
    })

  const remove = (id: string) =>
    run(async () => {
      await api.deleteComment(id)
      items.value = items.value.filter((c) => c.id !== id)
      count.value--
      return true
    })

  const loadMore = () =>
    run(async () => {
      if (!next.value) return
      const page = await api.comments(photoId, next.value)
      items.value = [...items.value, ...page.items]
      next.value = page.nextCursor
    })

  return { items, count, done: computed(() => !next.value), busy, turnstile, error, post, edit, remove, loadMore }
}
