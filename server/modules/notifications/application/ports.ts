import type { NotificationType } from '../domain/notifications'

export interface NewNotification {
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
  createdAt: Date
}

export interface StoredNotification extends Omit<NewNotification, 'userId'> {
  id: string
  readAt: Date | null
}

export interface NotificationsRepository {
  create(notification: NewNotification): Promise<void>
  /** Like notification of `userId` on `photoId` created at `since` or later, to group the next likes (US-35.2). */
  findLikeGroup(userId: string, photoId: string, since: Date): Promise<{ id: string; actorIds: string[] } | null>
  /** New likers of a group, which becomes unread again. */
  regroupLikes(id: string, actorIds: string[]): Promise<void>
  /** The `limit` latest notifications of `userId`, latest first (US-35.3). */
  list(userId: string, limit: number): Promise<StoredNotification[]>
  countUnread(userId: string): Promise<number>
  /** Marks the notification read at `at`, unless it already was; false if it is not one of `userId`'s. */
  markRead(userId: string, id: string, at: Date): Promise<boolean>
  markAllRead(userId: string, at: Date): Promise<void>
  /** Deletes the notifications created before `before` (US-35.5). */
  purgeBefore(before: Date): Promise<void>
}
