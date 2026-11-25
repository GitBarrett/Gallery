import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { baseJpeg, jpegExif, jpegWith } from '../../../../tests/builders/images'
import { withRollback } from '../../../../tests/db'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { photoProcessConsumer } from '../interface/photo-process-consumer'
import { gameVersions, photoMetadata, photos, photoTags, users } from '../../../db/schema'
import { drizzleCatalogRepository } from '../../catalog'
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
        title: null,
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

  it('US-11.1 US-11.2 US-11.3 writes the details with the completion, not on a second one', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const catalog = drizzleCatalogRepository(tx)
      const userId = await member(tx)
      await repo.createUpload(upload(ids[0]!, userId))
      const zoneId = (await catalog.zoneId('stormwind'))!
      const tagIds = await catalog.ensureTags([`t26d ${userId.slice(0, 6)}`, `night ${userId.slice(0, 6)}`])
      const details = {
        description: 'Long story',
        altText: 'Canals at night',
        caption: 'Glow',
        zoneId,
        tagIds,
        focalX: 0.25,
        focalY: 0.75,
      }
      const at = new Date()
      expect(await repo.complete(ids[0]!, { title: 'Dusk', gameVersion: 'wow-forever', at, details })).toBe(true)
      expect(await repo.complete(ids[0]!, { title: 'Again', gameVersion: 'wow-forever', at, details })).toBe(false)
      const [row] = await tx
        .select({
          description: photos.description,
          altText: photos.altText,
          focalX: photos.focalX,
          focalY: photos.focalY,
        })
        .from(photos)
        .where(eq(photos.id, ids[0]!))
      expect(row).toEqual({ description: 'Long story', altText: 'Canals at night', focalX: 0.25, focalY: 0.75 })
      const metadata = await tx.select().from(photoMetadata).where(eq(photoMetadata.photoId, ids[0]!))
      expect(metadata).toEqual([expect.objectContaining({ zoneId, zoneCustom: null, caption: 'Glow' })])
      const tagged = await tx.select().from(photoTags).where(eq(photoTags.photoId, ids[0]!))
      expect(tagged.map((t) => t.tagId).sort()).toEqual([...tagIds].sort())
    })
  })

  it('US-35.3 gives the titles of the captures that still exist, for the notifications', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      await repo.createUpload(upload(ids[0]!, userId))
      await repo.createUpload(upload(ids[1]!, userId))
      await repo.complete(ids[0]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      const gone = crypto.randomUUID()
      expect(await repo.titles([ids[0]!, ids[1]!, gone])).toEqual(
        new Map([
          [ids[0]!, 'Dusk'],
          [ids[1]!, null],
        ]),
      )
      expect(await repo.titles([])).toEqual(new Map())
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
      const { uow, sent } = inMemoryUnitOfWork(repo)
      const moderate = async () => ({ outcome: 'published' as const, score: 0.02 })
      const clock = { now: () => new Date('2026-11-25T10:00:00Z') }
      const consume = photoProcessConsumer({ repo, uow, storage, images, moderate, clock })
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
          moderationScore: photos.moderationScore,
          publishedAt: photos.publishedAt,
        })
        .from(photos)
        .where(eq(photos.id, ids[0]!))
      expect(row).toEqual({
        status: 'published',
        bytes: baseJpeg().length,
        width: 3840,
        height: 2160,
        lumaBl: 0,
        lumaTr: 0,
        moderationScore: 0.02,
        publishedAt: new Date('2026-11-25T10:00:00Z'),
      })
      expect(sent()).toHaveLength(1) // US-14.3: the author is notified once
    })
  })

  it('US-10.8 ends only a capture still processing failed', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      const measures = {
        bytes: 40,
        width: 1920,
        height: 1080,
        lumaBl: 0.5,
        lumaTr: 0.25,
        moderationScore: 0.6,
        publishedAt: null,
      }
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
