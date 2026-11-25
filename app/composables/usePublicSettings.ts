import { api } from '~/services/api'

/**
 * GET /api/settings/public (quality thresholds, feature flags), shared by the page under one key; null while unknown
 * or on error. During SSR it forwards the visitor's cookies (Cloudflare Access on previews): plain $fetch drops them.
 */
export function usePublicSettings() {
  const fetch = useRequestFetch()
  const { data } = useAsyncData('settings-public', () => api.publicSettings(fetch))
  return computed(() => data.value ?? null)
}
