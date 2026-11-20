import { loadConfig } from '../platform/config'
import { createContainer, type Container } from '../platform/container'

declare module 'h3' {
  interface H3EventContext {
    correlationId: string
    container: Container
  }
}

// Configuration validée au démarrage : une variable manquante empêche le Worker de servir (T-02a).
export default defineNitroPlugin((nitroApp) => {
  const config = loadConfig(process.env)
  nitroApp.hooks.hook('request', (event) => {
    event.context.correlationId = getHeader(event, 'cf-ray') ?? crypto.randomUUID()
    event.context.container = createContainer({ config, correlationId: event.context.correlationId })
  })
})
