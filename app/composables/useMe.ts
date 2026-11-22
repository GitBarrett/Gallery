import { api, ApiError } from '~/services/api'

/**
 * Signed-in member of GET /api/me (Q45), null for a visitor; shared by the page under the key `me`, which sign-in
 * and sign-out refresh with refreshNuxtData('me'). Awaited, so that a page can redirect a visitor during SSR.
 */
export async function useMe() {
  const fetch = useRequestFetch() // forwards the session cookie during SSR
  const { data } = await useAsyncData('me', () =>
    api.me(fetch).catch((error) => {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return null
      throw error
    }),
  )
  return { me: computed(() => data.value ?? null) }
}
