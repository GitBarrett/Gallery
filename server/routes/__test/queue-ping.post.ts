import type { Bindings } from '../../platform/bindings'

// Preview uniquement (exclue des autres builds, nuxt.config.ts) : prouve qu'un message de file est traité (T-03b)
export default defineEventHandler(async (event) => {
  const queue = (event.context.cloudflare?.env as Bindings | undefined)?.NOTIFICATIONS_QUEUE
  if (!queue) {
    setResponseStatus(event, 503)
    return { sent: false }
  }
  await queue.send({ type: 'heartbeat', at: event.context.container.clock.now().toISOString() })
  return { sent: true }
})
