import { and, asc, eq, inArray, isNull, lt } from 'drizzle-orm'
import type { Bindings, QueueProducer } from '../platform/bindings'
import type { Clock } from '../platform/clock'
import type { QueueTopic } from '../platform/unit-of-work'
import type { Db } from './client'
import { outbox, processedMessages } from './schema'

export type QueueProducers = Record<QueueTopic, QueueProducer | undefined>

export const queuesOf = (env: Bindings): QueueProducers => ({
  'photo-process': env.PHOTO_PROCESS_QUEUE,
  notifications: env.NOTIFICATIONS_QUEUE,
  emails: env.EMAILS_QUEUE,
  feedback: env.FEEDBACK_QUEUE,
  'account-purge': env.ACCOUNT_PURGE_QUEUE,
})

const BATCH = 100
const DAY = 86_400_000

/**
 * Outbox → Queues relay: sends the unpublished events (or those in `ids`), then marks them published. A send
 * that succeeds without the mark being saved is sent again: consumers are idempotent on `eventId`.
 */
export const outboxRelay = (db: Db, queues: QueueProducers, clock: Clock) => ({
  async publish(ids?: string[]): Promise<number> {
    const rows = await db
      .select()
      .from(outbox)
      .where(and(isNull(outbox.publishedAt), ids && inArray(outbox.id, ids)))
      .orderBy(asc(outbox.createdAt))
      .limit(BATCH)
    for (const row of rows) {
      const queue = queues[row.topic as QueueTopic]
      if (!queue) throw new Error(`no producer for topic ${row.topic}`)
      await queue.send({ eventId: row.id, payload: row.payload })
      await db.update(outbox).set({ publishedAt: clock.now() }).where(eq(outbox.id, row.id))
    }
    return rows.length
  },

  /** Daily purge: outbox published over 7 days ago, messages processed over 30 days ago (Queues keeps 4 days). */
  async purge(): Promise<void> {
    const now = clock.now().getTime()
    await db.delete(outbox).where(lt(outbox.publishedAt, new Date(now - 7 * DAY)))
    await db.delete(processedMessages).where(lt(processedMessages.processedAt, new Date(now - 30 * DAY)))
  },
})
export type OutboxRelay = ReturnType<typeof outboxRelay>
