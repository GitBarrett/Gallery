import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { notifications } from '../../../db/schema'
import type { NotificationsRepository } from '../application/ports'
import type { NotificationType } from '../domain/notifications'

export const drizzleNotificationsRepository = (db: Db | Transaction): NotificationsRepository => ({
  async create(notification) {
    await db.insert(notifications).values(notification)
  },
  async findLikeGroup(userId, photoId, since) {
    const [row] = await db
      .select({ id: notifications.id, payload: notifications.payload })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, 'like'),
          sql`${notifications.payload}->>'photoId' = ${photoId}`,
          gte(notifications.createdAt, since),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1)
    return row ? { id: row.id, actorIds: (row.payload as { actorIds: string[] }).actorIds } : null
  },
  async regroupLikes(id, actorIds) {
    await db
      .update(notifications)
      .set({
        payload: sql`jsonb_set(${notifications.payload}, '{actorIds}', ${JSON.stringify(actorIds)}::jsonb)`,
        readAt: null,
      })
      .where(eq(notifications.id, id))
  },
  async list(userId, limit) {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
    return rows.map((r) => ({ ...r, type: r.type as NotificationType, payload: r.payload as Record<string, unknown> }))
  },
  async countUnread(userId) {
    const [row] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return row?.n ?? 0
  },
  async markRead(userId, id, at) {
    const updated = await db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, ${at.toISOString()}::timestamptz)` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id })
    return updated.length > 0
  },
  async markAllRead(userId, at) {
    await db
      .update(notifications)
      .set({ readAt: at })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  },
  async purgeBefore(before) {
    await db.delete(notifications).where(lt(notifications.createdAt, before))
  },
})
