import { createDb, type Db } from '../db/client'
import { queuesOf } from '../db/outbox'
import { drizzleSettingsRepository, settingsReader } from '../modules/settings'
import type { Bindings } from '../platform/bindings'
import { systemClock } from '../platform/clock'
import { loadConfig } from '../platform/config'
import { createContainer, type Container } from '../platform/container'

declare module 'h3' {
  interface H3EventContext {
    correlationId: string
    container: Container
    db?: Db
  }
}

// Configuration validated at startup: a missing variable prevents the Worker from serving (T-02a).
export default defineNitroPlugin((nitroApp) => {
  const config = loadConfig(process.env)
  // Bindings only exist in a request: the settings cache is created at the first one and lives with the isolate
  let readSettings: ReturnType<typeof settingsReader> | undefined
  nitroApp.hooks.hook('request', (event) => {
    const env: Bindings = event.context.cloudflare?.env ?? {}
    readSettings ??= settingsReader({
      repository: drizzleSettingsRepository(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL),
      clock: systemClock,
    })
    // Node test server and local runs without Hyperdrive: the database of DATABASE_URL
    const connection = env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL
    const db = () => {
      if (!connection) throw new Error('no database in this environment')
      return (event.context.db ??= createDb(connection))
    }
    event.context.correlationId = getHeader(event, 'cf-ray') ?? crypto.randomUUID()
    event.context.container = createContainer({
      config,
      correlationId: event.context.correlationId,
      readSettings,
      db,
      queues: queuesOf(env),
      bucket: env.R2,
    })
  })
  // Called after errors too (h3): the request's connection is closed once the response is sent
  nitroApp.hooks.hook('afterResponse', async (event) => {
    await event.context.db?.$client.end()
  })
})
