// Automatic moderation of a capture (US-50, 02-specs § 6): the max score of the provider against the thresholds of
// site_settings (`moderation.scores`), never written here (US-50.5).
export type ModerationOutcome = 'published' | 'pending_review' | 'rejected'
export interface ModerationThresholds {
  review: number
  reject: number
}

/** `score` null: the provider did not answer, a moderator decides (US-50.4). */
export function decide(score: number | null, thresholds: ModerationThresholds): ModerationOutcome {
  if (score === null) return 'pending_review'
  if (score >= thresholds.reject) return 'rejected'
  if (score >= thresholds.review) return 'pending_review'
  return 'published'
}
