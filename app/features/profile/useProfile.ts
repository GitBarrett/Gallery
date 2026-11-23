import { api, ApiError } from '~/services/api'

/** Public profile of `username` (US-05.3), loaded during SSR; null for an unknown, banned or deleted account. */
export async function useProfile(username: Ref<string>) {
  const fetch = useRequestFetch()
  const { data } = await useAsyncData(
    () => `profile:${username.value.toLowerCase()}`,
    () =>
      api.profile(username.value, fetch).catch((error) => {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
        throw error
      }),
  )
  return { profile: computed(() => data.value ?? null) }
}
