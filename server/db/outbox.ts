import { and, asc, eq, inArray, isNull, lt } from 'drizzle-orm'
import type { QueueProducer } from '../platform/bindings'
import type { Clock } from '../platform/clock'
import type { QueueTopic } from '../platform/unit-of-work'
import type { Db } from './client'
import { outbox, processedMessages } from './schema'

export type QueueProducers = Record<QueueTopic, QueueProducer | undefined>

const BATCH = 100
const DAY = 86_400_000

/**
 * Relais outbox → Queues : envoie les événements non publiés (ou ceux de `ids`) puis les marque publiés. Un envoi
 * qui réussit sans que le marquage aboutisse sera renvoyé : les consommateurs sont idempotents sur `eventId`.
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

  /** Purge quotidienne : outbox publiée depuis 7 jours, messages traités depuis 30 jours (Queues garde 4 jours). */
  async purge(): Promise<void> {
    const now = clock.now().getTime()
    await db.delete(outbox).where(lt(outbox.publishedAt, new Date(now - 7 * DAY)))
    await db.delete(processedMessages).where(lt(processedMessages.processedAt, new Date(now - 30 * DAY)))
  },
})
export type OutboxRelay = ReturnType<typeof outboxRelay>
