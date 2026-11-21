import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Conventions (03-architecture.md § Modèle de données) : clés UUID v7, dates en timestamptz UTC, index sur les clés
// étrangères. Les statuts sont du texte contraint plutôt que des enums Postgres, plus simples à faire évoluer en
// expand → contract.
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const at = (name: string) => timestamp(name, { withTimezone: true })

/** Événements écrits dans la transaction de la donnée métier, relayés vers les Queues (10-clean-architecture.md § 4). */
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

/** Idempotence des consommateurs de Queue : un message déjà traité est ignoré. */
export const processedMessages = pgTable(
  'processed_messages',
  {
    consumer: text('consumer').notNull(),
    messageId: text('message_id').notNull(),
    processedAt: at('processed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.consumer, t.messageId] })],
)

/** Réglages modifiables depuis l'admin (seuils, flags `features.*`, hero…). */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by'), // clé étrangère vers users ajoutée avec la table (T-11a)
  updatedAt: at('updated_at').notNull().defaultNow(),
})

/** Journal d'audit en insertion seule : le rôle applicatif n'a ni UPDATE ni DELETE (migration 0001). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id'), // clé étrangère vers users ajoutée avec la table (T-11a)
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

/** Limites strictes à fenêtre longue (heure, jour) ; la clé est un HMAC (action + compte ou IP). */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    keyHmac: text('key_hmac').notNull(),
    windowStart: at('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.keyHmac, t.windowStart] }), index('rate_limit_window_idx').on(t.windowStart)],
)

/** Dons (v1.1, flag `features.donations` désactivé) : aucun lien obligatoire vers un compte. */
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
