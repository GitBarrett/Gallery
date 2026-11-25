import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photos } from '../../../db/schema'
import type { MediaRepository } from '../application/ports'

/** photos table: the uploads of T-21 and their processing (T-22b), the other columns arrive with their tasks. */
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
        status: photos.status,
        uploadedAt: photos.uploadedAt,
        title: photos.title,
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
  async finishProcessing(id, status, processed) {
    const rows = await db
      .update(photos)
      .set({ status, ...processed })
      .where(and(eq(photos.id, id), eq(photos.status, 'processing')))
      .returning({ id: photos.id })
    return rows.length > 0
  },
  async failProcessing(id) {
    const rows = await db
      .update(photos)
      .set({ status: 'failed' })
      .where(and(eq(photos.id, id), eq(photos.status, 'processing')))
      .returning({ id: photos.id })
    return rows.length > 0
  },
  async titles(ids) {
    if (!ids.length) return new Map()
    const rows = await db.select({ id: photos.id, title: photos.title }).from(photos).where(inArray(photos.id, ids))
    return new Map(rows.map((r) => [r.id, r.title]))
  },
  async listOwn(userId, { before, limit }) {
    const rows = await db
      .select({
        id: photos.id,
        title: photos.title,
        status: photos.status,
        width: photos.width,
        height: photos.height,
        uploadedAt: photos.uploadedAt,
      })
      .from(photos)
      .where(and(eq(photos.userId, userId), isNotNull(photos.uploadedAt), before ? lt(photos.id, before) : undefined))
      .orderBy(desc(photos.id))
      .limit(limit)
    return rows.map((r) => ({ ...r, uploadedAt: r.uploadedAt! }))
  },
})
