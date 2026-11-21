import { createDb } from '../db/client'
import { outboxRelay, type QueueProducers } from '../db/outbox'
import { purgeRateLimitCounters } from '../db/rate-limiter'
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

// Consumers per queue (name without preview suffix): each module adds its own with its task.
const consumers: Record<string, MessageHandler> = {}

const queuesOf = (env: Bindings): QueueProducers => ({
  'photo-process': env.PHOTO_PROCESS_QUEUE,
  notifications: env.NOTIFICATIONS_QUEUE,
  emails: env.EMAILS_QUEUE,
  feedback: env.FEEDBACK_QUEUE,
  'account-purge': env.ACCOUNT_PURGE_QUEUE,
})

/** Runs a job with the database (Hyperdrive), then closes the connection: each cron opens its own. */
const withDb =
  (env: Bindings, run: (db: ReturnType<typeof createDb>) => Promise<unknown>): CronHandler =>
  async () => {
    if (!env.HYPERDRIVE) return
    const db = createDb(env.HYPERDRIVE.connectionString)
    try {
      return await run(db)
    } finally {
      await db.$client.end()
    }
  }
const relayOf = (env: Bindings, db: ReturnType<typeof createDb>) => outboxRelay(db, queuesOf(env), systemClock)

const crons = (env: Bindings): Record<string, CronHandler[]> => ({
  '0 * * * *': [
    ...(env.NOTIFICATIONS_QUEUE ? [heartbeatCron(env.NOTIFICATIONS_QUEUE, systemClock)] : []),
    // Relay of the events a queue refused after the commit (T-05b)
    // shortcut: up to 1 h of delay and 100 events per run, switch to */5 with the contests cron (T-64a)
    withDb(env, (db) => relayOf(env, db).publish()),
    withDb(env, (db) => purgeRateLimitCounters(db, systemClock)), // ended windows (T-05c)
  ],
  '15 3 * * *': [withDb(env, (db) => relayOf(env, db).purge())],
})

// Nitro hooks validated by T-00f; acknowledgement happens message by message in dispatchBatch.
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
