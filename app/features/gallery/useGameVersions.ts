import { api } from '~/services/api'

/** Game versions of the catalogue, not archived, in their display order (US-20), shared by the page under one key. */
export async function useGameVersions() {
  const { data } = await useAsyncData('game-versions', api.gameVersions)
  return computed(() => data.value?.versions ?? [])
}
