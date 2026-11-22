import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

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

/** Accounts (identity module). Email and username are unique ignoring case; the username keeps its display case. */
export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email'), // null: OAuth account without email
    emailVerifiedAt: at('email_verified_at'),
    passwordHash: text('password_hash'), // PHC string (ADR-015); null: OAuth only
    username: text('username').notNull(),
    usernameChangedAt: at('username_changed_at'),
    avatarKey: text('avatar_key'),
    avatarPendingKey: text('avatar_pending_key'),
    bio: text('bio'),
    locale: text('locale').notNull().default('en'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    deletionRequestedAt: at('deletion_requested_at'),
    termsAcceptedAt: at('terms_accepted_at'),
    termsVersion: text('terms_version'),
    qualityIntroSentAt: at('quality_intro_sent_at'),
    notificationPrefs: jsonb('notification_prefs').notNull().default({}),
    mfaTotpSecretEnc: text('mfa_totp_secret_enc'), // AES-GCM, MFA_ENCRYPTION_KEY
    mfaEnabledAt: at('mfa_enabled_at'),
    contestBanUntil: at('contest_ban_until'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
    uniqueIndex('users_username_unique').on(sql`lower(${t.username})`),
    check('users_locale_check', sql`${t.locale} in ('en', 'fr')`),
    check('users_role_check', sql`${t.role} in ('user', 'moderator', 'admin')`),
    check('users_status_check', sql`${t.status} in ('active', 'suspended', 'banned', 'pending_deletion')`),
  ],
)

/** Server sessions: the sealed cookie carries a 256-bit id, only its SHA-256 is stored (ADR-010). */
export const sessions = pgTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: at('last_seen_at').notNull().defaultNow(),
    expiresAt: at('expires_at').notNull(),
    revokedAt: at('revoked_at'),
    mfaVerifiedAt: at('mfa_verified_at'),
    reauthAt: at('reauth_at'),
    userAgentSummary: text('user_agent_summary'),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

/** Single-use email links: 256-bit token, only its SHA-256 is stored (08-securite.md § 3). */
export const emailTokens = pgTable(
  'email_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    newEmail: text('new_email'), // email_change only
    expiresAt: at('expires_at').notNull(),
    usedAt: at('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('email_tokens_user_idx').on(t.userId),
    check('email_tokens_type_check', sql`${t.type} in ('verify', 'reset', 'email_change', 'deletion_cancel')`),
  ],
)

/** Settings editable from the admin (thresholds, `features.*` flags, hero…). */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

/** Insert-only audit log: the application role has neither UPDATE nor DELETE (migration 0001). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
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
