// Notification preferences (US-35.4): the types a member may turn off. Moderation decisions and quality tiers
// cannot be turned off, so they have no preference.
export const NOTIFICATION_PREFS = ['likes', 'comments', 'followers', 'contests'] as const
export type NotificationPref = (typeof NOTIFICATION_PREFS)[number]
export type NotificationPrefs = Record<NotificationPref, boolean>

/** Stored preferences (users.notification_prefs, `{}` by default) → every type, on unless set to `false`. */
export const notificationPrefs = (stored: unknown): NotificationPrefs =>
  Object.fromEntries(
    NOTIFICATION_PREFS.map((pref) => [pref, (stored as Record<string, unknown> | null)?.[pref] !== false]),
  ) as NotificationPrefs
