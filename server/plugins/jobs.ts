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
import {
  emailsConsumer,
  fakeMailer,
  mailboxMailer,
  purgeExpiredRedirects,
  purgeExpiredTokens,
  resendMailer,
  type Mailer,
} from '../modules/identity'
import {
  drizzleMediaRepository,
  imagesBindingService,
  photoProcessConsumer,
  purgeOrphanUploads,
  r2ObjectStorage,
  type R2Bucket,
} from '../modules/media'
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
function consumers(db: Db, logger: Logger, env: Bindings): Record<string, MessageHandler> {
  const config = loadConfig(process.env)
  const fetcher = (url: string, init?: RequestInit) => fetch(url, init)
  // Key checked at sending time: a missing one fails the email messages only (DLQ), not the other queues
  const mailer: Mailer = config.fakeProviders
    ? env.R2
      ? mailboxMailer({ bucket: env.R2, prefix: config.r2Prefix }) // previews: read by /__test/mailbox
      : fakeMailer(logger)
    : {
        send: (message) =>
          resendMailer({
            apiKey: required(config.resendApiKey, 'RESEND_API_KEY'),
            from: EMAIL_FROM,
            fetch: fetcher,
          }).send(message),
      }
  const ids = uuidV7Generator(systemClock)
  const handlers: Record<string, MessageHandler> = {
    emails: emailsConsumer({ db, mailer, clock: systemClock, ids, siteUrl: config.siteUrl }),
  }
  // Without R2 or Images (local runs), captures wait in the queue
  if (env.R2 && env.IMAGES)
    handlers['photo-process'] = photoProcessConsumer({
      repo: drizzleMediaRepository(db),
      storage: r2ObjectStorage({ bucket: env.R2, prefix: config.r2Prefix, now: systemClock.now }),
      images: imagesBindingService(env.IMAGES),
    })
  return handlers
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

// Deletes through the binding only: the S3 token, which signs uploads, is not needed
const purgeOrphans = (db: Db, bucket: R2Bucket) =>
  purgeOrphanUploads({
    repo: drizzleMediaRepository(db),
    storage: r2ObjectStorage({ bucket, prefix: loadConfig(process.env).r2Prefix, now: systemClock.now }),
    clock: systemClock,
  })()

const crons = (env: Bindings): Record<string, CronHandler[]> => ({
  '0 * * * *': [
    ...(env.NOTIFICATIONS_QUEUE ? [heartbeatCron(env.NOTIFICATIONS_QUEUE, systemClock)] : []),
    // Relay of the events a queue refused after the commit (T-05b)
    // shortcut: up to 1 h of delay and 100 events per run, switch to */5 with the contests cron (T-64a)
    withDb(env, (db) => relayOf(env, db).publish()),
    withDb(env, (db) => purgeRateLimitCounters(db, systemClock)), // ended windows (T-05c)
    withDb(env, (db) => purgeExpiredTokens(db, systemClock)),
    ...(env.R2 ? [withDb(env, (db) => purgeOrphans(db, env.R2!))] : []), // uploads never completed (US-10.7)
  ],
  '15 3 * * *': [
    withDb(env, (db) => relayOf(env, db).purge()),
    withDb(env, (db) => purgeExpiredRedirects(db, systemClock)), // former usernames (T-16b)
  ],
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
      await dispatchBatch({ queue: batch.queue, messages }, consumers(db, logger, env as Bindings), logger)
    } finally {
      await db.$client.end()
    }
  })
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const logger = createLogger({ correlationId: `cron:${controller.scheduledTime}`, module: 'jobs' })
    await dispatchCron(controller.cron, crons(env as Bindings), logger)
  })
})
