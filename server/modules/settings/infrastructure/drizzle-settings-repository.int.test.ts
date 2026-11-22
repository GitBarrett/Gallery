import { like } from 'drizzle-orm'
import { afterAll } from 'vitest'
import { settingsRepositoryContract } from '../../../../tests/contracts/settings-repository.contract'
import { createDb } from '../../../db/client'
import { siteSettings } from '../../../db/schema'
import { drizzleSettingsRepository } from './drizzle-settings-repository'

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  await db.delete(siteSettings).where(like(siteSettings.key, 'contract.%'))
  await db.$client.end()
})

settingsRepositoryContract('Drizzle', async (rows) => {
  await db.insert(siteSettings).values(rows)
  return drizzleSettingsRepository(process.env.DATABASE_URL)
})
