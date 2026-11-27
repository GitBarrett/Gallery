import { and, eq, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, likes, photos, users } from '../../../db/schema'
import type { LikesRepository } from '../application/ports'

// The like and the counter change in one statement: of two concurrent likes, one inserts, one finds the row
const counter = async (db: Db | Transaction, photoId: string) =>
  (await db.select({ n: photos.likesCount }).from(photos).where(eq(photos.id, photoId)))[0]?.n ?? 0

/** likes table and the counter and notified tier of photos. */
export const drizzleLikesRepository = (db: Db | Transaction): LikesRepository => ({
  async target(photoId) {
    const [row] = await db
      .select({
        authorId: photos.userId,
        status: photos.status,
        archived: gameVersions.archived,
        authorStatus: users.status,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .leftJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .where(eq(photos.id, photoId))
    if (!row) return null
    // The rule of the grids (gallery visible()): published, version not archived, author neither banned nor leaving
    const shown =
      row.status === 'published' && row.archived === false && !['banned', 'pending_deletion'].includes(row.authorStatus)
    return { authorId: row.authorId, public: shown }
  },
  async add(userId, photoId) {
    const rows = await db.execute<{ likes: number }>(sql`
      with added as (
        insert into ${likes} (user_id, photo_id) values (${userId}::uuid, ${photoId}::uuid)
        on conflict do nothing returning photo_id
      )
      update ${photos} set likes_count = likes_count + 1
      where ${photos.id} in (select photo_id from added) returning likes_count as likes`)
    const [row] = Array.from(rows)
    return row ? { changed: true, likes: row.likes } : { changed: false, likes: await counter(db, photoId) }
  },
  async remove(userId, photoId) {
    const rows = await db.execute<{ likes: number }>(sql`
      with gone as (
        delete from ${likes} where user_id = ${userId}::uuid and photo_id = ${photoId}::uuid returning photo_id
      )
      update ${photos} set likes_count = likes_count - 1
      where ${photos.id} in (select photo_id from gone) returning likes_count as likes`)
    const [row] = Array.from(rows)
    return row ? { changed: true, likes: row.likes } : { changed: false, likes: await counter(db, photoId) }
  },
  async state(userId, photoId) {
    const [row] = await db
      .select({ likes: photos.likesCount, mine: likes.userId })
      .from(photos)
      .leftJoin(likes, and(eq(likes.photoId, photos.id), eq(likes.userId, userId)))
      .where(eq(photos.id, photoId))
    return { liked: Boolean(row?.mine), likes: row?.likes ?? 0 }
  },
  async raiseNotifiedTier(photoId, tier) {
    const rows = await db
      .update(photos)
      .set({ qualityTierNotified: tier })
      .where(and(eq(photos.id, photoId), sql`${photos.qualityTierNotified} < ${tier}`))
      .returning({ id: photos.id })
    return rows.length > 0
  },
})
