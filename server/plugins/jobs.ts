import { createDb, type Db } from '../db/client'
import { outboxRelay, queuesOf } from '../db/outbox'
import { purgeRateLimitCounters } from '../db/rate-limiter'
import { drizzleUnitOfWork } from '../db/unit-of-work'
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
  drizzleIdentityRepository,
  emailsConsumer,
  fakeMailer,
  mailboxMailer,
  purgeExpiredRedirects,
  purgeExpiredTokens,
  resendMailer,
  type Mailer,
} from '../modules/identity'
import {
  cloudflareCachePurger,
  drizzleDownloadLog,
  drizzleMediaRepository,
  imagesBindingService,
  photoProcessConsumer,
  purgeDownloads,
  purgeOrphanUploads,
  r2ObjectStorage,
  type R2Bucket,
} from '../modules/media'
import {
  drizzleModerationDecisions,
  fakeModerationProvider,
  moderateCapture,
  sightengineProvider,
  type ModerationProvider,
} from '../modules/moderation'
import { drizzleNotificationsRepository, notificationsConsumer, purgeNotifications } from '../modules/notifications'
import { drizzleSettingsRepository, settingsReader } from '../modules/settings'
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
    notifications: notificationsConsumer({ db, clock: systemClock }),
  }
  // Without R2 or Images (local runs), captures wait in the queue
  if (env.R2 && env.IMAGES) {
    const storage = r2ObjectStorage({ bucket: env.R2, prefix: config.r2Prefix, now: systemClock.now })
    const images = imagesBindingService(env.IMAGES)
    const moderate = autoModeration(db, logger, config, env)
    handlers['photo-process'] = photoProcessConsumer({
      repo: drizzleMediaRepository(db),
      uow: drizzleUnitOfWork(db, drizzleMediaRepository, relayOf(env, db), logger),
      storage,
      images,
      moderate,
      clock: systemClock,
      // US-07.6: the avatar versions live on the account (identity)
      avatars: {
        accounts: drizzleIdentityRepository(db),
        uow: drizzleUnitOfWork(db, drizzleIdentityRepository, relayOf(env, db), logger),
        storage,
        images,
        moderate,
        purger: cloudflareCachePurger({ token: config.cfApiTokenPurge, zoneId: config.cfZoneId, fetch: fetcher }),
        siteUrl: config.siteUrl,
      },
    })
  }
  return handlers
}

// Thresholds read at each capture (60 s cache): an admin change applies without redeploy (US-50.5). Missing
// Sightengine keys only send the captures to review (US-50.4, Q42).
function autoModeration(db: Db, logger: Logger, config: ReturnType<typeof loadConfig>, env: Bindings) {
  const repository = drizzleSettingsRepository(env.HYPERDRIVE?.connectionString)
  const settings = settingsReader({ repository, clock: systemClock })
  const provider: ModerationProvider = config.fakeProviders
    ? fakeModerationProvider()
    : {
        check: (image, context) =>
          sightengineProvider({
            apiUser: required(config.sightengineApiUser, 'SIGHTENGINE_API_USER'),
            apiSecret: required(config.sightengineApiSecret, 'SIGHTENGINE_API_SECRET'),
            fetch: (url, init) => fetch(url, init),
          }).check(image, context),
      }
  return moderateCapture({
    provider,
    decisions: drizzleModerationDecisions(db),
    thresholds: async () => (await settings(logger))['moderation.scores'],
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    logger,
  })
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
    withDb(env, (db) => purgeNotifications({ repo: drizzleNotificationsRepository(db), clock: systemClock })()),
    withDb(env, (db) => purgeDownloads({ downloads: drizzleDownloadLog(db), clock: systemClock })()), // US-23.1
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
