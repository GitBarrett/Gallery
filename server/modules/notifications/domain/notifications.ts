import type { NotificationPref, NotificationPrefs } from '../../../../shared/domain/notification-prefs'

// Events of US-35.1; the payload holds ids only: names and titles are read at display time (a deleted account
// disappears from its notifications on its own).
export const NOTIFICATION_TYPES = ['like', 'comment', 'follow', 'moderation', 'quality', 'contest'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Moderation decisions and quality tiers cannot be turned off (US-35.4)
const PREF_OF: Record<NotificationType, NotificationPref | null> = {
  like: 'likes',
  comment: 'comments',
  follow: 'followers',
  contest: 'contests',
  moderation: null,
  quality: null,
}

/** Whether the recipient wants this type of notification (US-35.4). */
export const wanted = (type: NotificationType, prefs: NotificationPrefs) => {
  const pref = PREF_OF[type]
  return pref === null || prefs[pref]
}

/** Likes on the same capture within this window make one notification, « X and N others liked… » (US-35.2). */
export const LIKE_GROUP_MS = 60 * 60 * 1000

/** Likers of a group, latest last (X is the latest, N the others); a liker counts once. */
export const withLiker = (actorIds: readonly string[], actorId: string) => [
  ...actorIds.filter((id) => id !== actorId),
  actorId,
]

/** Retention of 6 months (US-35.5). */
export const purgeLimit = (now: Date) => {
  const limit = new Date(now)
  limit.setUTCMonth(limit.getUTCMonth() - 6)
  return limit
}
