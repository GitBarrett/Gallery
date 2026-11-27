import { and, eq, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { likes, photos } from '../../../db/schema'
import type { LikesRepository } from '../application/ports'
import { photoTarget } from './photo-target'

// The like and the counter change in one statement: of two concurrent likes, one inserts, one finds the row
const counter = async (db: Db | Transaction, photoId: string) =>
  (await db.select({ n: photos.likesCount }).from(photos).where(eq(photos.id, photoId)))[0]?.n ?? 0

/** likes table and the counter and notified tier of photos. */
export const drizzleLikesRepository = (db: Db | Transaction): LikesRepository => ({
  target: (photoId) => photoTarget(db, photoId),
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
