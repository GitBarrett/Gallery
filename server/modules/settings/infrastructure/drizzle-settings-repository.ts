import { createDb } from '../../../db/client'
import { siteSettings } from '../../../db/schema'
import type { SettingsRepository } from '../application/read-settings'

/**
 * Reads site_settings on its own connection, opened only when the cache expires (once a minute per isolate).
 * Without database (local development, Node tests), there is no row: the launch values apply.
 */
export const drizzleSettingsRepository = (connectionString: string | undefined): SettingsRepository => ({
  async all() {
    if (!connectionString) return []
    const db = createDb(connectionString)
    try {
      return await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings)
    } finally {
      await db.$client.end()
    }
  },
})
