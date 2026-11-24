import type { NotificationPrefs } from '../../../../shared/domain/notification-prefs'
import type { Quality } from '../../../../shared/domain/quality'
import type { Clock } from '../../../platform/clock'
import { LIKE_GROUP_MS, purgeLimit, wanted, withLiker } from '../domain/notifications'
import type { NotificationsRepository } from './ports'

/** Event of the `notifications` queue: `userId` is the recipient. */
export type NotificationEvent = { userId: string } & (
  | { type: 'like'; photoId: string; actorId: string }
  | { type: 'comment'; photoId: string; commentId: string; actorId: string }
  | { type: 'follow'; actorId: string }
  | { type: 'moderation'; photoId?: string; outcome: 'published' | 'pending_review' | 'rejected' | 'failed' }
  | { type: 'quality'; photoId: string; quality: Quality }
  | {
      type: 'contest'
      contestId: string
      event: 'opened' | 'ending' | 'extended' | 'disqualified' | 'results'
      reason?: string
    }
)

/**
 * Creates the notification of an event (US-35.1), unless the recipient turned its type off (US-35.4) or no longer
 * exists. Likes on the same capture within an hour join one notification (US-35.2). The preferences are read here,
 * at creation: a change applies to the next notifications (US-07.5).
 */
export const notify =
  (deps: {
    repo: NotificationsRepository
    prefsOf: (userId: string) => Promise<NotificationPrefs | null>
    clock: Clock
  }) =>
  async (event: NotificationEvent): Promise<void> => {
    const prefs = await deps.prefsOf(event.userId)
    if (!prefs || !wanted(event.type, prefs)) return
    const now = deps.clock.now()
    const { userId, type, ...payload } = event
    if (event.type === 'like') {
      // shortcut: two likes handled at the same instant may make two groups, acceptable while likes are few (T-40)
      const group = await deps.repo.findLikeGroup(userId, event.photoId, new Date(now.getTime() - LIKE_GROUP_MS))
      if (group) return deps.repo.regroupLikes(group.id, withLiker(group.actorIds, event.actorId))
      return deps.repo.create({
        userId,
        type,
        payload: { photoId: event.photoId, actorIds: [event.actorId] },
        createdAt: now,
      })
    }
    await deps.repo.create({ userId, type, payload, createdAt: now })
  }

/** Daily purge of the notifications over 6 months old (US-35.5). */
export const purgeNotifications = (deps: { repo: NotificationsRepository; clock: Clock }) => () =>
  deps.repo.purgeBefore(purgeLimit(deps.clock.now()))
