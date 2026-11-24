import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { notifications } from '../../../db/schema'
import type { NotificationsRepository } from '../application/ports'

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
  async purgeBefore(before) {
    await db.delete(notifications).where(lt(notifications.createdAt, before))
  },
})
