import { z } from './zod'

/**
 * One entry of the Quest log (GET /api/notifications, US-35.3). Usernames and titles are read at display time (Q69):
 * an entry whose member or capture is gone is not listed.
 */
export const NotificationItem = z.strictObject({
  id: z.uuid(),
  type: z.enum(['like', 'comment', 'follow', 'moderation', 'quality', 'contest']),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
  /** The member behind it (the latest liker of a group), null for moderation, quality and contest entries. */
  actor: z.string().nullable(),
  /** Other likers of a group: « {actor} and {others} others liked… » (US-35.2). */
  others: z.int().min(0),
  photoId: z.uuid().nullable(),
  /** Null: capture without title yet, or no capture. */
  photoTitle: z.string().nullable(),
  /** Moderation outcome, quality tier or contest event. */
  detail: z.string().nullable(),
})
export type NotificationItem = z.infer<typeof NotificationItem>

export const NotificationsResponse = z.strictObject({ notifications: z.array(NotificationItem) })
export type NotificationsResponse = z.infer<typeof NotificationsResponse>

/** GET /api/notifications/unread-count: the bell's counter (US-35.1). */
export const UnreadCountResponse = z.strictObject({ unread: z.int().min(0) })
export type UnreadCountResponse = z.infer<typeof UnreadCountResponse>

/** POST /api/notifications/{id}/read */
export const NotificationParams = z.strictObject({ id: z.uuid() })
