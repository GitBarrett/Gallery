import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { baseJpeg } from '../../../../tests/builders/images'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { createDb } from '../../../db/client'
import { drizzleUnitOfWork } from '../../../db/unit-of-work'
import { moderationDecisions, outbox, photos, users } from '../../../db/schema'
import { drizzleModerationDecisions, fakeModerationProvider, moderateCapture } from '../../moderation'
import { drizzleSettingsRepository, settingsReader } from '../../settings'
import { drizzleMediaRepository } from '../infrastructure/drizzle-media-repository'
import { photoProcessConsumer } from './photo-process-consumer'

// The consumer as server/plugins/jobs.ts builds it (T-24): Drizzle unit of work and outbox, decisions table,
// thresholds from site_settings, fake provider. Only R2 and the Images binding are fakes here.
const db = createDb(process.env.DATABASE_URL!)
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const created: string[] = []

afterAll(async () => {
  for (const id of created) await db.delete(users).where(eq(users.id, id))
  await db.$client.end()
})

async function capture(title: string) {
  const [user] = await db
    .insert(users)
    .values({ username: `pm_${crypto.randomUUID().slice(0, 8)}` })
    .returning()
  created.push(user!.id)
  const repo = drizzleMediaRepository(db)
  const id = crypto.randomUUID()
  const file = baseJpeg()
  await repo.createUpload({ id, userId: user!.id, mime: 'image/jpeg', bytes: file.length, width: 1920, height: 1080 })
  await repo.complete(id, { title, gameVersion: 'wow-forever', at: new Date() })
  return { id, file }
}

describe('photo-process with the automatic moderation, wired as in production', () => {
  it.each([
    ['Fixture_nsfw', 'rejected'],
    ['Ice Crown', 'published'],
    ['Fixture_review', 'pending_review'],
  ])('US-50.1 US-50.3 US-14.3 « %s » ends %s, with its decision and the author notified', async (title, status) => {
    const { id, file } = await capture(title)
    const { storage, objects } = inMemoryObjectStorage()
    objects.set(`incoming/${id}`, { bytes: file.length, contentType: 'image/jpeg', data: file })
    const settings = settingsReader({
      repository: drizzleSettingsRepository(process.env.DATABASE_URL),
      clock: { now: () => new Date() },
    })
    const consume = photoProcessConsumer({
      repo: drizzleMediaRepository(db),
      uow: drizzleUnitOfWork(db, drizzleMediaRepository, { publish: async () => 0, purge: async () => {} }, logger),
      storage,
      images: fakeImageService({ format: 'image/jpeg', width: 1920, height: 1080 }).images,
      moderate: moderateCapture({
        provider: fakeModerationProvider(),
        decisions: drizzleModerationDecisions(db),
        thresholds: async () => (await settings(logger))['moderation.scores'],
        sleep: async () => {},
        logger,
      }),
      clock: { now: () => new Date() },
    })
    const body = { eventId: crypto.randomUUID(), payload: { kind: 'capture', photoId: id } }
    await consume(body, { id: 'm1', body, attempts: 1, ack() {}, retry() {} })

    const [row] = await db.select({ status: photos.status }).from(photos).where(eq(photos.id, id))
    expect(row?.status).toBe(status)
    const decisions = await db.select().from(moderationDecisions).where(eq(moderationDecisions.targetId, id))
    expect(decisions.map((d) => d.decision)).toEqual([status])
    const events = await db.select().from(outbox).where(eq(outbox.topic, 'notifications'))
    expect(events.some((e) => (e.payload as { photoId?: string }).photoId === id)).toBe(true)
    if (status === 'rejected') expect(objects.has(`trash/originals/${id}`)).toBe(true)
  })
})
