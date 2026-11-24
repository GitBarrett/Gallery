import { and, asc, count, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photos } from '../../../db/schema'
import type { MediaRepository } from '../application/ports'

/** photos table: the uploads of T-21, the other columns arrive with their tasks. */
export const drizzleMediaRepository = (db: Db | Transaction): MediaRepository => ({
  async createUpload(upload) {
    await db.insert(photos).values(upload)
  },
  async countIncomplete(userId, since) {
    const [row] = await db
      .select({ n: count() })
      .from(photos)
      .where(and(eq(photos.userId, userId), isNull(photos.uploadedAt), gte(photos.createdAt, since)))
    return row?.n ?? 0
  },
  async findUpload(id) {
    const [row] = await db
      .select({
        id: photos.id,
        userId: photos.userId,
        mime: photos.mime,
        bytes: photos.bytes,
        uploadedAt: photos.uploadedAt,
      })
      .from(photos)
      .where(eq(photos.id, id))
    return row ?? null
  },
  async complete(id, { title, gameVersion, at }) {
    // Conditional: of two concurrent calls, one only completes the capture (and publishes its event)
    const rows = await db
      .update(photos)
      .set({
        title,
        uploadedAt: at,
        gameVersionId: sql`(select ${gameVersions.id} from ${gameVersions} where ${gameVersions.slug} = ${gameVersion})`,
      })
      .where(and(eq(photos.id, id), isNull(photos.uploadedAt)))
      .returning({ id: photos.id })
    return rows.length > 0
  },
  async incompleteBefore(before, limit) {
    const rows = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(isNull(photos.uploadedAt), lt(photos.createdAt, before)))
      .orderBy(asc(photos.createdAt))
      .limit(limit)
    return rows.map((r) => r.id)
  },
  async deleteIncomplete(id) {
    await db.delete(photos).where(and(eq(photos.id, id), isNull(photos.uploadedAt)))
  },
})
