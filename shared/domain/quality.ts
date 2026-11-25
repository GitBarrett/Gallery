// Capture quality from its likes (07-design.md § Codes visuels WoW). Thresholds are configurable
// (site_settings.quality_thresholds), so they are always passed in, never written here.
export const QUALITIES = ['poor', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type Quality = (typeof QUALITIES)[number]

/** Minimum likes to reach each tier above Poor. */
export type QualityThresholds = Readonly<Record<Exclude<Quality, 'poor'>, number>>

export function qualityFromLikes(likes: number, thresholds: QualityThresholds): Quality {
  if (likes >= thresholds.legendary) return 'legendary'
  if (likes >= thresholds.epic) return 'epic'
  if (likes >= thresholds.rare) return 'rare'
  if (likes >= thresholds.uncommon) return 'uncommon'
  return 'poor'
}

/** Fewest likes of a tier (the « Minimum quality » filter, US-20.3): 0 for Poor. */
export const minLikes = (quality: Quality, thresholds: QualityThresholds) =>
  quality === 'poor' ? 0 : thresholds[quality]
