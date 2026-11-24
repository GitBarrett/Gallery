import { eq, inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { createDb } from '../../../db/client'
import { notifications, users } from '../../../db/schema'
import type { QueueMessage } from '../../../platform/jobs'
import { drizzleIdentityRepository } from '../../identity'
import { notificationsConsumer } from './notifications-consumer'

const db = createDb(process.env.DATABASE_URL!)
const created: string[] = []
const message = {} as QueueMessage

afterAll(async () => {
  if (created.length) await db.delete(users).where(inArray(users.id, created))
  await db.$client.end()
})

async function member() {
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `n${id.slice(0, 8)}` })
  created.push(id)
  return id
}
const rowsOf = (userId: string) => db.select().from(notifications).where(eq(notifications.userId, userId))
const deliver = (clock: string, payload: Record<string, unknown>) =>
  notificationsConsumer({ db, clock: fixedClock(clock) })({ eventId: crypto.randomUUID(), payload }, message)

describe('notifications consumer', () => {
  it('US-35.1 creates one notification per event, even when Queues delivers it twice', async () => {
    const userId = await member()
    const consume = notificationsConsumer({ db, clock: fixedClock('2026-11-24T10:00:00Z') })
    const body = { eventId: crypto.randomUUID(), payload: { type: 'follow', userId, actorId: crypto.randomUUID() } }
    await consume(body, message)
    await consume(body, message)
    const rows = await rowsOf(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'follow', readAt: null, createdAt: new Date('2026-11-24T10:00:00Z') })
  })

  it('US-35.2 groups the likes on the same capture within an hour, unread again', async () => {
    const [userId, photoId, ash, tyrande] = [
      await member(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]
    await deliver('2026-11-24T10:00:00Z', { type: 'like', userId, photoId, actorId: ash })
    await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId))
    await deliver('2026-11-24T10:30:00Z', { type: 'like', userId, photoId, actorId: tyrande })
    const rows = await rowsOf(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ payload: { photoId, actorIds: [ash, tyrande] }, readAt: null })
  })

  it('US-07.5 US-35.4 applies the stored preferences to the next notifications', async () => {
    const userId = await member()
    const like = { type: 'like', userId, photoId: crypto.randomUUID(), actorId: crypto.randomUUID() }
    await drizzleIdentityRepository(db).updateProfile(userId, { notificationPrefs: { likes: false } })
    await deliver('2026-11-24T10:00:00Z', like)
    await deliver('2026-11-24T10:00:00Z', { type: 'moderation', userId, outcome: 'rejected' })
    expect((await rowsOf(userId)).map((r) => r.type)).toEqual(['moderation'])

    await drizzleIdentityRepository(db).updateProfile(userId, { notificationPrefs: { likes: true } })
    await deliver('2026-11-24T10:05:00Z', like)
    expect((await rowsOf(userId)).map((r) => r.type).sort()).toEqual(['like', 'moderation'])
  })

  it('creates nothing for a deleted account, and refuses a message outside the contract (sent back, then DLQ)', async () => {
    const gone = crypto.randomUUID()
    await deliver('2026-11-24T10:00:00Z', { type: 'follow', userId: gone, actorId: crypto.randomUUID() })
    expect(await rowsOf(gone)).toEqual([])
    await expect(deliver('2026-11-24T10:00:00Z', { type: 'poke', userId: gone })).rejects.toThrow()
  })
})
