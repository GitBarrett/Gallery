import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photoMetadata, photos, photoTags } from '../../../db/schema'
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
  async complete(id, { title, gameVersion, at, details }) {
    const { description, altText, focalX, focalY, tagIds = [], ...metadata } = details ?? { tagIds: [] }
    // Conditional: of two concurrent calls, one only completes the capture (and publishes its event)
    const rows = await db
      .update(photos)
      .set({
        title,
        description,
        altText,
        focalX,
        focalY,
        uploadedAt: at,
        gameVersionId: sql`(select ${gameVersions.id} from ${gameVersions} where ${gameVersions.slug} = ${gameVersion})`,
      })
      .where(and(eq(photos.id, id), isNull(photos.uploadedAt)))
      .returning({ id: photos.id })
    if (!rows.length) return false
    // In the transaction of the caller (unit of work): the details are written with the completion or not at all
    await db.insert(photoMetadata).values({ photoId: id, ...metadata })
    if (tagIds.length) await db.insert(photoTags).values(tagIds.map((tagId) => ({ photoId: id, tagId })))
    return true
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
  async updateDetails(id, { metadata, tagIds, ...fields }) {
    await db.transaction(async (tx) => {
      if (Object.keys(fields).length) await tx.update(photos).set(fields).where(eq(photos.id, id))
      if (metadata && Object.keys(metadata).length)
        await tx
          .insert(photoMetadata)
          .values({ photoId: id, ...metadata })
          .onConflictDoUpdate({ target: photoMetadata.photoId, set: metadata })
      if (tagIds) {
        await tx.delete(photoTags).where(eq(photoTags.photoId, id))
        if (tagIds.length) await tx.insert(photoTags).values(tagIds.map((tagId) => ({ photoId: id, tagId })))
      }
    })
  },
  async findDetails(id) {
    const [row] = await db
      .select({
        id: photos.id,
        userId: photos.userId,
        status: photos.status,
        title: photos.title,
        width: photos.width,
        height: photos.height,
        description: photos.description,
        altText: photos.altText,
        focalX: photos.focalX,
        focalY: photos.focalY,
        zoneId: photoMetadata.zoneId,
        zoneCustom: photoMetadata.zoneCustom,
        inGameTime: photoMetadata.inGameTime,
        graphicsSettings: photoMetadata.graphicsSettings,
        characterName: photoMetadata.characterName,
        caption: photoMetadata.caption,
      })
      .from(photos)
      .leftJoin(photoMetadata, eq(photoMetadata.photoId, photos.id))
      .where(and(eq(photos.id, id), isNotNull(photos.uploadedAt)))
    if (!row) return null
    const tagged = await db.select({ tagId: photoTags.tagId }).from(photoTags).where(eq(photoTags.photoId, id))
    return { ...row, tagIds: tagged.map((t) => t.tagId) }
  },
  async deleteCapture(id) {
    const rows = await db.delete(photos).where(eq(photos.id, id)).returning({ id: photos.id })
    return rows.length > 0
  },
})
