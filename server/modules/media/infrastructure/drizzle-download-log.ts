import { lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { downloads, photos } from '../../../db/schema'
import type { DownloadLog } from '../application/ports'

/** downloads table and the counter of photos, in one statement: two concurrent requests count once. */
export const drizzleDownloadLog = (db: Db | Transaction): DownloadLog => ({
  async record(userId, photoId, day) {
    const rows = await db.execute<{ id: string }>(sql`
      with added as (
        insert into ${downloads} (user_id, photo_id, day) values (${userId}::uuid, ${photoId}::uuid, ${day}::date)
        on conflict do nothing returning photo_id
      )
      update ${photos} set downloads_count = downloads_count + 1
      where ${photos.id} in (select photo_id from added) returning ${photos.id}`)
    return Array.from(rows).length > 0
  },
  async purgeBefore(day) {
    const rows = await db.delete(downloads).where(lt(downloads.day, day)).returning({ day: downloads.day })
    return rows.length
  },
})
