import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { identityRepositoryContract } from '../../../../tests/contracts/identity-repository.contract'
import { withRollback } from '../../../../tests/db'
import { createDb } from '../../../db/client'
import { users } from '../../../db/schema'
import { drizzleIdentityRepository } from './drizzle-identity-repository'

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'Ash.%@Example.com')) // contract accounts, tokens cascade
  await db.$client.end()
})

identityRepositoryContract('Drizzle', async () => drizzleIdentityRepository(db))

describe('drizzleIdentityRepository', () => {
  it('keeps the transaction usable after a duplicate account', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleIdentityRepository(tx)
      const user = {
        id: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@example.com`,
        username: `u${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'h',
        locale: 'en' as const,
        termsAcceptedAt: new Date(),
        termsVersion: '2026-11-22',
      }
      await repo.createUser(user)
      expect(await repo.createUser({ ...user, id: crypto.randomUUID() })).toBe('email_taken')
      await repo.markEmailVerified(user.id, new Date('2026-11-22T12:00:00Z'))
      const [row] = await tx.select().from(users).where(eq(users.id, user.id))
      expect(row).toMatchObject({ emailVerifiedAt: new Date('2026-11-22T12:00:00Z'), termsVersion: '2026-11-22' })
    })
  })
})
