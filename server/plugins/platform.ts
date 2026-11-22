import { drizzleSettingsRepository, settingsReader } from '../modules/settings'
import type { Bindings } from '../platform/bindings'
import { systemClock } from '../platform/clock'
import { loadConfig } from '../platform/config'
import { createContainer, type Container } from '../platform/container'

declare module 'h3' {
  interface H3EventContext {
    correlationId: string
    container: Container
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
      repository: drizzleSettingsRepository(env.HYPERDRIVE?.connectionString),
      clock: systemClock,
    })
    event.context.correlationId = getHeader(event, 'cf-ray') ?? crypto.randomUUID()
    event.context.container = createContainer({ config, correlationId: event.context.correlationId, readSettings })
  })
})
