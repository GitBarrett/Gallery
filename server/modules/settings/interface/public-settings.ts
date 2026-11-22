import type { PublicSettings } from '../../../../shared/contracts/settings'
import type { SiteSettings } from '../domain/settings'

/** Non-sensitive values only (03-architecture.md § Inventaire): quality thresholds and feature flags. */
export const toPublicSettings = (s: SiteSettings): PublicSettings => ({
  qualityThresholds: s['quality.thresholds'],
  features: {
    contests: s['features.contests'],
    follows: s['features.follows'],
    collections: s['features.collections'],
    leaderboard: s['features.leaderboard'],
    ads: s['features.ads'],
    donations: s['features.donations'],
    readonly: s['features.readonly'],
    inviteOnly: s['features.inviteOnly'],
  },
})
