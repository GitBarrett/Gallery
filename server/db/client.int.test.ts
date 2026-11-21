import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../tests/db'
import { outbox } from './schema'

describe('withRollback (11-strategie-de-tests.md § 6)', () => {
  it('lets a test write and read, then cancels everything', async () => {
    const topic = `test-${Date.now()}`
    await withRollback(async (db) => {
      await db.insert(outbox).values({ topic, payload: { a: 1 } })
      expect(await db.select().from(outbox).where(eq(outbox.topic, topic))).toHaveLength(1)
    })
    await withRollback(async (db) => {
      expect(await db.select().from(outbox).where(eq(outbox.topic, topic))).toHaveLength(0)
    })
  })

  it('still cancels when the test fails', async () => {
    const topic = `failing-${Date.now()}`
    await expect(
      withRollback(async (db) => {
        await db.insert(outbox).values({ topic, payload: {} })
        throw new Error('test failure')
      }),
    ).rejects.toThrow('test failure')
    await withRollback(async (db) => {
      expect(await db.select().from(outbox).where(eq(outbox.topic, topic))).toHaveLength(0)
    })
  })
})
