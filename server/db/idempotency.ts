import type { Db, Transaction } from './client'
import { processedMessages } from './schema'

/**
 * Idempotency guard of consumers (Queues delivers at least once): `work` runs only once per
 * (consumer, event), in the transaction that records the message. If it fails, nothing is recorded and the
 * next delivery runs it again. Returns `false` for an ignored duplicate.
 */
export async function onceOnly(
  db: Db,
  consumer: string,
  eventId: string,
  work: (tx: Transaction) => Promise<void>,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const recorded = await tx
      .insert(processedMessages)
      .values({ consumer, messageId: eventId })
      .onConflictDoNothing()
      .returning({ id: processedMessages.messageId })
    if (!recorded.length) return false
    await work(tx)
    return true
  })
}
