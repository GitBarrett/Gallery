import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import { downloads, photos, users } from '../../../db/schema'
import { drizzleDownloadLog } from './drizzle-download-log'

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0]

async function world(tx: Tx) {
  const run = crypto.randomUUID().slice(0, 8)
  const members = await tx
    .insert(users)
    .values([{ username: `dl_a_${run}` }, { username: `dl_b_${run}` }])
    .returning()
  const [photo] = await tx
    .insert(photos)
    .values({ userId: members[0]!.id, mime: 'image/png', bytes: 1, width: 1920, height: 1080 })
    .returning()
  const count = async () =>
    (await tx.select({ n: photos.downloadsCount }).from(photos).where(eq(photos.id, photo!.id)))[0]!.n
  return { a: members[0]!.id, b: members[1]!.id, photoId: photo!.id, count }
}

describe('drizzleDownloadLog', () => {
  it('US-23.1 counts a download once per member, capture and day', async () => {
    await withRollback(async (tx) => {
      const log = drizzleDownloadLog(tx)
      const w = await world(tx)
      expect(await log.record(w.a, w.photoId, '2026-11-26')).toBe(true)
      expect(await log.record(w.a, w.photoId, '2026-11-26')).toBe(false)
      expect(await w.count()).toBe(1)
      expect(await log.record(w.b, w.photoId, '2026-11-26')).toBe(true)
      expect(await log.record(w.a, w.photoId, '2026-11-27')).toBe(true)
      expect(await w.count()).toBe(3)
    })
  })

  it('deletes the downloads before a day, the counter stays', async () => {
    await withRollback(async (tx) => {
      const log = drizzleDownloadLog(tx)
      const w = await world(tx)
      await log.record(w.a, w.photoId, '2000-01-01')
      await log.record(w.a, w.photoId, '2000-01-02')
      expect(await log.purgeBefore('2000-01-02')).toBe(1)
      const left = await tx.select({ day: downloads.day }).from(downloads).where(eq(downloads.photoId, w.photoId))
      expect(left).toEqual([{ day: '2000-01-02' }])
      expect(await w.count()).toBe(2)
    })
  })
})
