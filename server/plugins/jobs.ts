import { createDb, type Db } from '../db/client'
import { outboxRelay, queuesOf } from '../db/outbox'
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
import { emailsConsumer, fakeMailer, purgeExpiredTokens, resendMailer, type Mailer } from '../modules/identity'
import { loadConfig } from '../platform/config'
import { uuidV7Generator } from '../platform/ids'
import { createLogger, type Logger } from '../platform/logger'

// shortcut: sending domain to set up with the site domain (Q24); until then Resend refuses other senders
const EMAIL_FROM = 'Legendary Shots <noreply@mail.legendaryshots.gg>'

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

// Consumers per queue (name without preview suffix): each module adds its own with its task.
function consumers(db: Db, logger: Logger): Record<string, MessageHandler> {
  const config = loadConfig(process.env)
  const fetcher = (url: string, init?: RequestInit) => fetch(url, init)
  // Key checked at sending time: a missing one fails the email messages only (DLQ), not the other queues
  const mailer: Mailer = config.fakeProviders
    ? fakeMailer(logger)
    : {
        send: (message) =>
          resendMailer({
            apiKey: required(config.resendApiKey, 'RESEND_API_KEY'),
            from: EMAIL_FROM,
            fetch: fetcher,
          }).send(message),
      }
  const ids = uuidV7Generator(systemClock)
  return { emails: emailsConsumer({ db, mailer, clock: systemClock, ids, siteUrl: config.siteUrl }) }
}

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
    withDb(env, (db) => purgeExpiredTokens(db, systemClock)),
  ],
  '15 3 * * *': [withDb(env, (db) => relayOf(env, db).purge())],
})

// Nitro hooks validated by T-00f; acknowledgement happens message by message in dispatchBatch.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async ({ batch, env }) => {
    const logger = createLogger({ correlationId: `queue:${batch.queue}`, module: 'jobs' })
    const messages = batch.messages as readonly QueueMessage[]
    const connection = (env as Bindings).HYPERDRIVE?.connectionString
    // Without database (local runs), only heartbeats are handled; other messages go back to the queue
    if (!connection) return dispatchBatch({ queue: batch.queue, messages }, {}, logger)
    const db = createDb(connection) // one connection per batch
    try {
      await dispatchBatch({ queue: batch.queue, messages }, consumers(db, logger), logger)
    } finally {
      await db.$client.end()
    }
  })
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const logger = createLogger({ correlationId: `cron:${controller.scheduledTime}`, module: 'jobs' })
    await dispatchCron(controller.cron, crons(env as Bindings), logger)
  })
})
