import type { Bindings } from '../../platform/bindings'

// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): proves that a queue message is processed (T-03b)
export default defineEventHandler(async (event) => {
  const queue = (event.context.cloudflare?.env as Bindings | undefined)?.NOTIFICATIONS_QUEUE
  if (!queue) {
    setResponseStatus(event, 503)
    return { sent: false }
  }
  await queue.send({ type: 'heartbeat', at: event.context.container.clock.now().toISOString() })
  return { sent: true }
})
