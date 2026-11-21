import type { Db, Transaction } from './client'
import { processedMessages } from './schema'

/**
 * Garde d'idempotence des consommateurs (Queues livre au moins une fois) : `work` ne s'exécute qu'une fois par
 * (consommateur, événement), dans la transaction qui enregistre le message. S'il échoue, rien n'est enregistré et la
 * livraison suivante le relance. Renvoie `false` pour un doublon ignoré.
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
