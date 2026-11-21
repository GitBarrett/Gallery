import { TransactionRollbackError } from 'drizzle-orm'
import { createDb, type Transaction } from '../server/db/client'

/** Exécute un test d'intégration dans une transaction toujours annulée (11-strategie-de-tests.md § 6). */
export async function withRollback(run: (db: Transaction) => Promise<void>): Promise<void> {
  const db = createDb(process.env.DATABASE_URL!)
  try {
    await db.transaction(async (tx) => {
      await run(tx)
      tx.rollback()
    })
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error
  } finally {
    await db.$client.end()
  }
}
