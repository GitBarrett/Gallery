import type { Logger } from '../platform/logger'
import type { DomainEvent, UnitOfWork } from '../platform/unit-of-work'
import type { Db, Transaction } from './client'
import type { OutboxRelay } from './outbox'
import { outbox } from './schema'

/**
 * UnitOfWork Drizzle : les événements sont écrits dans l'outbox dans la transaction du travail, puis publiés juste
 * après le commit. Si la file refuse, le travail reste réussi et le cron horaire relaie l'événement.
 */
export function drizzleUnitOfWork<Scope>(
  db: Db,
  scopeOf: (tx: Transaction) => Scope,
  relay: OutboxRelay,
  logger: Logger,
): UnitOfWork<Scope> {
  return {
    async run(work) {
      const ids: string[] = []
      const result = await db.transaction(async (tx) => {
        const events: DomainEvent[] = []
        const value = await work(scopeOf(tx), (event) => events.push(event))
        if (events.length)
          ids.push(...(await tx.insert(outbox).values(events).returning({ id: outbox.id })).map((r) => r.id))
        return value
      })
      if (ids.length)
        await relay.publish(ids).catch((error) => logger.warn('outbox publish failed, left to the relay', { error }))
      return result
    },
  }
}
