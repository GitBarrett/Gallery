/** Flags `features.*` of site_settings that show or hide navigation entries (07-design.md § Header). */
export interface FeatureFlags {
  leaderboard: boolean
  contests: boolean
  collections: boolean
}

// shortcut: launch values hard-coded (every v1.x entry hidden), read from GET /api/settings/public in T-08
export function useFeatureFlags(): FeatureFlags {
  return { leaderboard: false, contests: false, collections: false }
}
