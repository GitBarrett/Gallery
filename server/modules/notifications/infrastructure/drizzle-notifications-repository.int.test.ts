import { inArray } from 'drizzle-orm'
import { afterAll } from 'vitest'
import { notificationsRepositoryContract } from '../../../../tests/contracts/notifications-repository.contract'
import { createDb } from '../../../db/client'
import { users } from '../../../db/schema'
import { drizzleNotificationsRepository } from './drizzle-notifications-repository'

const db = createDb(process.env.DATABASE_URL!)
const created: string[] = []

afterAll(async () => {
  if (created.length) await db.delete(users).where(inArray(users.id, created)) // cascades to notifications
  await db.$client.end()
})

notificationsRepositoryContract('Drizzle', async () => {
  const userId = crypto.randomUUID()
  await db.insert(users).values({ id: userId, username: `n${userId.slice(0, 8)}` })
  created.push(userId)
  return { repo: drizzleNotificationsRepository(db), userId }
})
