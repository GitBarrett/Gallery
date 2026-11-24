import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { baseJpeg, jpegExif, jpegWith } from '../../../../tests/builders/images'
import { withRollback } from '../../../../tests/db'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { photoProcessConsumer } from '../interface/photo-process-consumer'
import { gameVersions, photos, users } from '../../../db/schema'
import { drizzleMediaRepository } from './drizzle-media-repository'

const HOUR = 3_600_000
const upload = (id: string, userId: string) => ({
  id,
  userId,
  mime: 'image/png' as const,
  bytes: 42,
  width: 1920,
  height: 1080,
})
const ids = ['0193a000-0000-7000-8000-000000000001', '0193a000-0000-7000-8000-000000000002']

async function member(tx: Parameters<Parameters<typeof withRollback>[0]>[0]) {
  const [row] = await tx
    .insert(users)
    .values({ username: `media_${crypto.randomUUID().slice(0, 8)}` })
    .returning()
  return row!.id
}

describe('drizzleMediaRepository', () => {
  it('US-10.1 creates an incomplete upload, then completes it once with the version of the slug', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      await repo.createUpload(upload(ids[0]!, userId))
      expect(await repo.findUpload(ids[0]!)).toEqual({
        id: ids[0],
        userId,
        mime: 'image/png',
        bytes: 42,
        status: 'processing',
        uploadedAt: null,
      })
      const at = new Date()
      expect(await repo.complete(ids[0]!, { title: 'Dusk', gameVersion: 'wow-forever', at })).toBe(true)
      expect(await repo.complete(ids[0]!, { title: 'Again', gameVersion: 'wow-forever', at })).toBe(false)
      const [row] = await tx
        .select({ title: photos.title, status: photos.status, version: gameVersions.slug })
        .from(photos)
        .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
        .where(eq(photos.id, ids[0]!))
      expect(row).toEqual({ title: 'Dusk', status: 'processing', version: 'wow-forever' })
      expect(await repo.findUpload(ids[1]!)).toBeNull()
    })
  })

  it('US-10.5 counts the incomplete uploads of the member since a date', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      const other = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      await repo.createUpload(upload('0193a000-0000-7000-8000-000000000003', other))
      await repo.complete(ids[1]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      expect(await repo.countIncomplete(userId, new Date(Date.now() - HOUR))).toBe(1)
      expect(await repo.countIncomplete(userId, new Date(Date.now() + HOUR))).toBe(0)
    })
  })

  it('US-10.7 lists and deletes the uploads never completed before a date, never a completed one', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      await tx
        .update(photos)
        .set({ createdAt: new Date(Date.now() - 25 * HOUR) })
        .where(eq(photos.userId, userId))
      await repo.complete(ids[1]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      const before = new Date(Date.now() - 24 * HOUR)
      // Other test files share the table: only this member's rows are checked
      const listed = await repo.incompleteBefore(before, 100)
      expect(listed).toContain(ids[0])
      expect(listed).not.toContain(ids[1])
      for (const id of ids) await repo.deleteIncomplete(id)
      const left = await tx.select({ id: photos.id }).from(photos).where(eq(photos.userId, userId))
      expect(left.map((r) => r.id)).toEqual([ids[1]])
    })
  })

  it('US-14.2 a message delivered twice processes the capture once, with the same result', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      const file = jpegWith([jpegExif()])
      await repo.createUpload({ ...upload(ids[0]!, userId), mime: 'image/jpeg', bytes: file.length })
      await repo.complete(ids[0]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      const { storage, objects } = inMemoryObjectStorage()
      objects.set(`incoming/${ids[0]}`, { bytes: file.length, contentType: 'image/jpeg', data: file })
      const { images, renders } = fakeImageService({ format: 'image/jpeg', width: 3840, height: 2160 })
      const consume = photoProcessConsumer({ repo, storage, images })
      const body = { eventId: ids[1], payload: { kind: 'capture', photoId: ids[0] } }
      const message = { id: 'm1', body, attempts: 1, ack() {}, retry() {} }
      await consume(body, message)
      const first = new Map(objects)
      await consume(body, { ...message, attempts: 2 })
      expect(objects).toEqual(first)
      expect(renders).toHaveLength(6)
      const [row] = await tx
        .select({
          status: photos.status,
          bytes: photos.bytes,
          width: photos.width,
          height: photos.height,
          lumaBl: photos.lumaBl,
          lumaTr: photos.lumaTr,
        })
        .from(photos)
        .where(eq(photos.id, ids[0]!))
      expect(row).toEqual({
        status: 'pending_review',
        bytes: baseJpeg().length,
        width: 3840,
        height: 2160,
        lumaBl: 0,
        lumaTr: 0,
      })
    })
  })

  it('US-10.8 ends only a capture still processing failed', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      const measures = { bytes: 40, width: 1920, height: 1080, lumaBl: 0.5, lumaTr: 0.25 }
      expect(await repo.finishProcessing(ids[0]!, 'pending_review', measures)).toBe(true)
      expect(await repo.finishProcessing(ids[0]!, 'pending_review', measures)).toBe(false)
      expect(await repo.failProcessing(ids[0]!)).toBe(false)
      expect(await repo.failProcessing(ids[1]!)).toBe(true)
      expect(await repo.failProcessing(ids[1]!)).toBe(false)
      const rows = await tx
        .select({ id: photos.id, status: photos.status })
        .from(photos)
        .where(eq(photos.userId, userId))
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
        [ids[0]!]: 'pending_review',
        [ids[1]!]: 'failed',
      })
    })
  })
})
