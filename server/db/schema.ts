import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Conventions (03-architecture.md § Modèle de données): UUID v7 keys, timestamptz UTC dates, indexes on foreign
// keys. Statuses are constrained text rather than Postgres enums, simpler to evolve with
// expand → contract.
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const at = (name: string) => timestamp(name, { withTimezone: true })

/** Events written in the transaction of the business data, relayed to the Queues (10-clean-architecture.md § 4). */
export const outbox = pgTable(
  'outbox',
  {
    id: id(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
    publishedAt: at('published_at'),
  },
  (t) => [
    index('outbox_unpublished_idx')
      .on(t.createdAt)
      .where(sql`${t.publishedAt} is null`),
  ],
)

/** Queue consumer idempotency: a message already processed is ignored. */
export const processedMessages = pgTable(
  'processed_messages',
  {
    consumer: text('consumer').notNull(),
    messageId: text('message_id').notNull(),
    processedAt: at('processed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.consumer, t.messageId] })],
)

/** Settings editable from the admin (thresholds, `features.*` flags, hero…). */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by'), // foreign key to users added with that table (T-11a)
  updatedAt: at('updated_at').notNull().defaultNow(),
})

/** Insert-only audit log: the application role has neither UPDATE nor DELETE (migration 0001). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id'), // foreign key to users added with that table (T-11a)
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_target_idx').on(t.targetType, t.targetId),
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
)

/** Strict limits over long windows (hour, day); the key is an HMAC (action + account or IP). */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    keyHmac: text('key_hmac').notNull(),
    windowStart: at('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.keyHmac, t.windowStart] }), index('rate_limit_window_idx').on(t.windowStart)],
)

/** Donations (v1.1, `features.donations` flag disabled): no mandatory link to an account. */
export const donations = pgTable(
  'donations',
  {
    id: id(),
    providerRef: text('provider_ref').notNull().unique(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    badgeOptIn: boolean('badge_opt_in').notNull().default(false),
    createdAt: createdAt(),
    confirmedAt: at('confirmed_at'),
  },
  (t) => [
    check('donations_status_check', sql`${t.status} in ('pending', 'succeeded', 'failed', 'canceled')`),
    check('donations_amount_check', sql`${t.amountCents} > 0`),
    check('donations_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
)
