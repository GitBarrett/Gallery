import { and, desc, eq, notInArray, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { comments, photos, users } from '../../../db/schema'
import type { CommentsRepository } from '../application/ports'
import { photoTarget } from './photo-target'

/** comments table and the counter of photos, changed in the same statement. */
export const drizzleCommentsRepository = (db: Db | Transaction): CommentsRepository => ({
  target: (photoId) => photoTarget(db, photoId),
  async accountCreatedAt(userId) {
    const [row] = await db.select({ at: users.createdAt }).from(users).where(eq(users.id, userId))
    return row?.at ?? null
  },
  async add({ photoId, userId, body }) {
    const rows = await db.execute<{ id: string; created_at: string }>(sql`
      with added as (
        insert into ${comments} (photo_id, user_id, body) values (${photoId}::uuid, ${userId}::uuid, ${body})
        returning id, photo_id, created_at
      ), counted as (
        update ${photos} set comments_count = comments_count + 1 where ${photos.id} in (select photo_id from added)
      )
      select id, created_at from added`)
    const [row] = Array.from(rows)
    return { id: row!.id, createdAt: new Date(row!.created_at) }
  },
  async find(id) {
    const [row] = await db
      .select({
        id: comments.id,
        photoId: comments.photoId,
        userId: comments.userId,
        photoAuthorId: photos.userId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(photos, eq(photos.id, comments.photoId))
      .where(eq(comments.id, id))
    return row ?? null
  },
  async edit(id, body, at) {
    await db.update(comments).set({ body, editedAt: at }).where(eq(comments.id, id))
  },
  async remove(id) {
    const rows = await db.execute<{ id: string }>(sql`
      with gone as (delete from ${comments} where id = ${id}::uuid returning id, photo_id, status),
      counted as (
        update ${photos} set comments_count = comments_count - 1
        where ${photos.id} in (select photo_id from gone where status = 'visible')
      )
      select id from gone`)
    return Array.from(rows).length > 0
  },
  async list(photoId, after, limit) {
    // The position of the last comment shown, read from the table: the Date of the cursor holds milliseconds,
    // `created_at` microseconds (the neighbours of the photo page met it). A deleted last comment ends the list.
    const position = after
      ? sql`(${comments.createdAt}, ${comments.id}) < (select c.created_at, c.id from comments c where c.id = ${after.id}::uuid)`
      : undefined
    return db
      .select({
        id: comments.id,
        body: comments.body,
        userId: comments.userId,
        username: users.username,
        avatarKey: users.avatarKey,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(
        and(
          eq(comments.photoId, photoId),
          eq(comments.status, 'visible'),
          notInArray(users.status, ['banned', 'pending_deletion']),
          position,
        ),
      )
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(limit)
  },
})
