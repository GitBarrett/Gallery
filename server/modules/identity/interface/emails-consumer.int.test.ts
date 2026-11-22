import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { recordingMailer } from '../../../../tests/fakes/recording-mailer'
import { createDb } from '../../../db/client'
import { emailTokens, users } from '../../../db/schema'
import type { QueueMessage } from '../../../platform/jobs'
import { purgeExpiredTokens } from '../infrastructure/drizzle-identity-repository'
import { emailsConsumer } from './emails-consumer'

const db = createDb(process.env.DATABASE_URL!)
const clock = fixedClock('2026-11-22T12:00:00Z')
const userId = crypto.randomUUID()

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId))
  await db.$client.end()
})

describe('emails consumer', () => {
  it('US-01.1 sends one verification email per event, even when Queues delivers it twice', async () => {
    await db.insert(users).values({ id: userId, email: `${userId}@example.com`, username: `c${userId.slice(0, 8)}` })
    const { mailer, sent } = recordingMailer()
    const ids = { next: () => crypto.randomUUID() }
    const consume = emailsConsumer({ db, mailer, clock, ids, siteUrl: 'https://legendaryshots.gg' })
    const body = { eventId: crypto.randomUUID(), payload: { template: 'verify', userId } }
    await consume(body, {} as QueueMessage)
    await consume(body, {} as QueueMessage)
    expect(sent).toHaveLength(1)
    expect(await db.select().from(emailTokens).where(eq(emailTokens.userId, userId))).toHaveLength(1)

    await purgeExpiredTokens(db, fixedClock('2026-11-23T12:00:01Z')) // 24 h later
    expect(await db.select().from(emailTokens).where(eq(emailTokens.userId, userId))).toEqual([])
  })

  it('refuses a message outside the contract (sent back, then DLQ)', async () => {
    const { mailer } = recordingMailer()
    const consume = emailsConsumer({ db, mailer, clock, ids: { next: () => '' }, siteUrl: 'https://x' })
    await expect(
      consume({ eventId: crypto.randomUUID(), payload: { template: 'nope' } }, {} as QueueMessage),
    ).rejects.toThrow()
  })
})
