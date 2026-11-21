import { createDb } from '../db/client'
import { outboxRelay, type QueueProducers } from '../db/outbox'
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

const queuesOf = (env: Bindings): QueueProducers => ({
  'photo-process': env.PHOTO_PROCESS_QUEUE,
  notifications: env.NOTIFICATIONS_QUEUE,
  emails: env.EMAILS_QUEUE,
  feedback: env.FEEDBACK_QUEUE,
  'account-purge': env.ACCOUNT_PURGE_QUEUE,
})

/** Exécute un traitement avec la base (Hyperdrive), puis ferme la connexion : chaque cron ouvre la sienne. */
const withRelay =
  (env: Bindings, run: (relay: ReturnType<typeof outboxRelay>) => Promise<unknown>): CronHandler =>
  async () => {
    if (!env.HYPERDRIVE) return
    const db = createDb(env.HYPERDRIVE.connectionString)
    try {
      return await run(outboxRelay(db, queuesOf(env), systemClock))
    } finally {
      await db.$client.end()
    }
  }

const crons = (env: Bindings): Record<string, CronHandler[]> => ({
  '0 * * * *': [
    ...(env.NOTIFICATIONS_QUEUE ? [heartbeatCron(env.NOTIFICATIONS_QUEUE, systemClock)] : []),
    // Relais des événements que la file a refusés après le commit (T-05b)
    // shortcut: jusqu'à 1 h de retard et 100 événements par passage, passer à */5 avec le cron des concours (T-64a)
    withRelay(env, (relay) => relay.publish()),
  ],
  '15 3 * * *': [withRelay(env, (relay) => relay.purge())],
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
