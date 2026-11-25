/** Flags `features.*` of site_settings that show or hide navigation entries (07-design.md § Header). */
export interface FeatureFlags {
  leaderboard: boolean
  contests: boolean
  collections: boolean
}

const HIDDEN: FeatureFlags = { leaderboard: false, contests: false, collections: false }

/** Public flags of GET /api/settings/public, shared by the page; entries stay hidden while unknown or on error. */
export function useFeatureFlags() {
  const settings = usePublicSettings()
  return computed<FeatureFlags>(() => settings.value?.features ?? HIDDEN)
}
