import type { NotificationType } from '../domain/notifications'

export interface NewNotification {
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
  createdAt: Date
}

export interface NotificationsRepository {
  create(notification: NewNotification): Promise<void>
  /** Like notification of `userId` on `photoId` created at `since` or later, to group the next likes (US-35.2). */
  findLikeGroup(userId: string, photoId: string, since: Date): Promise<{ id: string; actorIds: string[] } | null>
  /** New likers of a group, which becomes unread again. */
  regroupLikes(id: string, actorIds: string[]): Promise<void>
  /** Deletes the notifications created before `before` (US-35.5). */
  purgeBefore(before: Date): Promise<void>
}
