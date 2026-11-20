import type { Bindings } from '../platform/bindings'
import { systemClock } from '../platform/clock'
import {
  dispatchBatch,
  dispatchCron,
  heartbeatCron,
  type CronHandler,
  type MessageHandler,
  type QueueMessage,
} from '../platform/jobs'
import { createLogger } from '../platform/logger'

// Consommateurs par file (nom sans suffixe de preview) : chaque module ajoute le sien avec sa tâche.
const consumers: Record<string, MessageHandler> = {}

const crons = (env: Bindings): Record<string, CronHandler[]> => ({
  '0 * * * *': env.NOTIFICATIONS_QUEUE ? [heartbeatCron(env.NOTIFICATIONS_QUEUE, systemClock)] : [],
  '15 3 * * *': [],
})

// Hooks Nitro validés par T-00f ; l'acquittement se fait message par message dans dispatchBatch.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async ({ batch }) => {
    const logger = createLogger({ correlationId: `queue:${batch.queue}`, module: 'jobs' })
    await dispatchBatch({ queue: batch.queue, messages: batch.messages as readonly QueueMessage[] }, consumers, logger)
  })
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const logger = createLogger({ correlationId: `cron:${controller.scheduledTime}`, module: 'jobs' })
    await dispatchCron(controller.cron, crons(env as Bindings), logger)
  })
})
