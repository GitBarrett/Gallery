import type { NewNotification, NotificationsRepository } from '../../server/modules/notifications'

/** In-memory NotificationsRepository for use case tests; `rows` shows the notifications. */
export function inMemoryNotificationsRepository() {
  const rows: (NewNotification & { id: string; readAt: Date | null })[] = []
  const repo: NotificationsRepository = {
    async create(notification) {
      rows.push({ ...notification, id: crypto.randomUUID(), readAt: null })
    },
    async findLikeGroup(userId, photoId, since) {
      const row = rows
        .filter(
          (r) => r.userId === userId && r.type === 'like' && r.payload.photoId === photoId && r.createdAt >= since,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      return row ? { id: row.id, actorIds: row.payload.actorIds as string[] } : null
    },
    async regroupLikes(id, actorIds) {
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, { payload: { ...row.payload, actorIds }, readAt: null })
    },
    async purgeBefore(before) {
      rows.splice(0, rows.length, ...rows.filter((r) => r.createdAt >= before))
    },
  }
  return { repo, rows }
}
