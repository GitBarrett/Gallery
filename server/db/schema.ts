import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
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

// Full-text search (ADR-007): `simple` configuration (no stemming, the proper nouns of both languages) on the text
// lower-cased without accents. `f_unaccent` is the immutable wrapper of unaccent made by migration 0020: a generated
// column may only call immutable functions.
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })
const words = (column: string, weight: 'A' | 'B' | 'C') =>
  `setweight(to_tsvector('simple', public.f_unaccent(lower(coalesce(${column}, '')))), '${weight}')`

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
    mfaLastStep: integer('mfa_last_step'), // last accepted 30 s TOTP step: replay refused

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

/** Provider identities linked to an account (US-02): one account per (provider, subject). */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('oauth_accounts_subject_unique').on(t.provider, t.providerUserId),
    index('oauth_accounts_user_idx').on(t.userId),
    check('oauth_accounts_provider_check', sql`${t.provider} in ('google', 'battlenet')`),
  ],
)

/** Former usernames: /u/{old} redirects (301) to the account for 90 days, then the daily cron purges (US-05.4). */
export const usernameRedirects = pgTable(
  'username_redirects',
  {
    oldUsername: text('old_username').primaryKey(), // lowercase
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: at('expires_at').notNull(),
  },
  (t) => [index('username_redirects_user_idx').on(t.userId)],
)

/** Social networks of a profile (US-82): an identifier per network, the website its https URL; deleted with the account. */
export const userSocialLinks = pgTable(
  'user_social_links',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    handle: text('handle').notNull(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.platform] }),
    check(
      'user_social_links_platform_check',
      sql`${t.platform} in ('twitch', 'youtube', 'x', 'bluesky', 'instagram', 'tiktok', 'reddit', 'discord', 'website')`,
    ),
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

/** 10 single-use staff recovery codes, made when the TOTP is enabled; only their SHA-256 is stored. */
export const mfaRecoveryCodes = pgTable(
  'mfa_recovery_codes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: at('used_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.codeHash] })],
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

/**
 * Beta invitations (US-56.4): single-use sign-up link valid 14 days, only the SHA-256 of its token is stored.
 * `email_hmac`: keyed fingerprint of the invited email, never the email itself (privacy policy).
 */
export const betaInvites = pgTable(
  'beta_invites',
  {
    id: id(),
    emailHmac: text('email_hmac').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    expiresAt: at('expires_at').notNull(),
    usedAt: at('used_at'),
  },
  (t) => [index('beta_invites_invited_by_idx').on(t.invitedBy)],
)

/** Waiting list of the beta (US-56.4), one entry per email ignoring case. */
export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: id(),
    email: text('email').notNull(),
    locale: text('locale').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('waitlist_entries_email_unique').on(sql`lower(${t.email})`),
    check('waitlist_entries_locale_check', sql`${t.locale} in ('en', 'fr')`),
  ],
)

/** Settings editable from the admin (thresholds, `features.*` flags, hero…). */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

/** Game versions of the catalogue (02 § Galerie), seeded by migration 0009; archived ones are hidden. */
export const gameVersions = pgTable('game_versions', {
  id: id(),
  slug: text('slug').notNull().unique(), // URL /v/{slug}
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  position: integer('position').notNull(),
  archived: boolean('archived').notNull().default(false),
  createdAt: createdAt(),
})

/** Tags, normalised (US-11.1): `slug` is the normalised form, searched by prefix. */
export const tags = pgTable(
  'tags',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    label: text('label').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('tags_slug_prefix_idx').on(t.slug.op('text_pattern_ops')),
    // Typos of a search (ADR-007): the `%` operator of pg_trgm, similarity ≥ 0.3
    index('tags_slug_trgm_idx').using('gin', t.slug.op('gin_trgm_ops')),
  ],
)

/**
 * Zones dictionary (US-57), seeded from docs/seed/zones.csv (migration 0011). Searched on both names and the aliases,
 * accents ignored and typos tolerated (pg_trgm, unaccent: migration 0010). `pending`: typed freely, to review.
 */
export const zones = pgTable(
  'zones',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameFr: text('name_fr').notNull(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [
    check('zones_status_check', sql`${t.status} in ('active', 'pending')`),
    // Typos of a search (ADR-007): each name as searched (lower case, no accents), for the `%` operator of pg_trgm
    index('zones_name_en_trgm_idx').using('gin', sql`public.f_unaccent(lower(${t.nameEn})) gin_trgm_ops`),
    index('zones_name_fr_trgm_idx').using('gin', sql`public.f_unaccent(lower(${t.nameFr})) gin_trgm_ops`),
  ],
)

/**
 * Captures (03-architecture.md § Modèle de données), created `processing` by the upload request (T-21) with the
 * declared file; `uploaded_at` set by `complete` with the title and the version; size and dimensions of the cleaned
 * original and luminances (0–1, 07-design.md § Texte sur image) set by the processing (T-22b). The other columns
 * arrive with their tasks (expand).
 */
export const photos = pgTable(
  'photos',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameVersionId: uuid('game_version_id').references(() => gameVersions.id),
    title: text('title'),
    description: text('description'),
    altText: text('alt_text'),
    status: text('status').notNull().default('processing'),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    lumaBl: real('luma_bl'),
    lumaTr: real('luma_tr'),
    /** Max score of the automatic moderation (US-50), null when the provider did not answer. */
    moderationScore: real('moderation_score'),
    publishedAt: at('published_at'),
    /** Focal point chosen by the author (US-13.1), 0–1 from the left and the top; null: the centre (US-13.2). */
    focalX: real('focal_x'),
    focalY: real('focal_y'),
    // shortcut: written by the likes (T-40) and the HD downloads (T-34), 0 until then; the grids sort on them (US-20.3)
    likesCount: integer('likes_count').notNull().default(0),
    downloadsCount: integer('downloads_count').notNull().default(0),
    uploadedAt: at('uploaded_at'),
    createdAt: createdAt(),
    /** Title (A) and description (C), ADR-007; the zone and the character are searched on photo_metadata. */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql.raw(`${words('title', 'A')} || ${words('description', 'C')}`),
    ),
  },
  (t) => [
    index('photos_search_idx').using('gin', t.searchVector),
    check(
      'photos_status_check',
      sql`${t.status} in ('processing', 'failed', 'pending_review', 'published', 'rejected', 'hidden')`,
    ),
    check(
      'photos_uploaded_check',
      sql`${t.uploadedAt} is null or (${t.title} is not null and ${t.gameVersionId} is not null)`,
    ),
    index('photos_user_idx').on(t.userId, t.createdAt),
    index('photos_game_version_idx').on(t.gameVersionId),
    // The grids (03 § Modèle de données): the published captures of a version, most recent first
    index('photos_grid_idx')
      .on(t.gameVersionId, t.publishedAt.desc(), t.id.desc())
      .where(sql`${t.status} = 'published'`),
    // Uploads never completed: the concurrent ones (3 per account) and the orphans of the hourly cron (US-10.7)
    index('photos_incomplete_idx')
      .on(t.createdAt)
      .where(sql`${t.uploadedAt} is null`),
  ],
)

/** In-app notifications (US-35): created by the `notifications` consumer, purged after 6 months (US-35.5). */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    readAt: at('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'notifications_type_check',
      sql`${t.type} in ('like', 'comment', 'follow', 'moderation', 'quality', 'contest')`,
    ),
    index('notifications_user_idx').on(t.userId, t.createdAt),
    index('notifications_created_idx').on(t.createdAt), // daily purge
  ],
)

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

/**
 * Moderation decisions (US-50.6, US-52): the automatic one of each capture (source `auto`, raw scores, once per
 * target), then the moderators' (T-58). Kept 1 year; the moderator's id is pseudonymised at account deletion (US-09.2).
 */
export const moderationDecisions = pgTable(
  'moderation_decisions',
  {
    id: id(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(), // no foreign key: the decision outlives a deleted capture
    decision: text('decision').notNull(),
    source: text('source').notNull(),
    moderatorId: uuid('moderator_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    scores: jsonb('scores'),
    createdAt: createdAt(),
  },
  (t) => [
    check('moderation_decisions_target_check', sql`${t.targetType} in ('photo', 'avatar')`),
    check('moderation_decisions_decision_check', sql`${t.decision} in ('published', 'pending_review', 'rejected')`),
    check('moderation_decisions_source_check', sql`${t.source} in ('auto', 'manual')`),
    // One automatic decision per target: a replayed message records nothing more (US-14.2)
    uniqueIndex('moderation_decisions_auto_idx')
      .on(t.targetType, t.targetId)
      .where(sql`${t.source} = 'auto'`),
    index('moderation_decisions_target_idx').on(t.targetId),
    index('moderation_decisions_moderator_idx').on(t.moderatorId),
    index('moderation_decisions_created_idx').on(t.createdAt), // yearly purge
  ],
)

/**
 * Details of a capture given at upload (US-11, 03-architecture.md § Modèle de données): zone of the dictionary or a
 * free one awaiting review (US-11.3, US-57), in-game time, settings, character, caption. One row per completed capture.
 */
export const photoMetadata = pgTable(
  'photo_metadata',
  {
    photoId: uuid('photo_id')
      .primaryKey()
      .references(() => photos.id, { onDelete: 'cascade' }),
    zoneId: uuid('zone_id').references(() => zones.id),
    zoneCustom: text('zone_custom'),
    inGameTime: text('in_game_time'),
    graphicsSettings: text('graphics_settings'),
    characterName: text('character_name'),
    caption: text('caption'),
    /** Character and free zone (B), ADR-007: a generated column only reads its own row. */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql.raw(`${words('character_name', 'B')} || ${words('zone_custom', 'B')}`),
    ),
  },
  (t) => [
    index('photo_metadata_search_idx').using('gin', t.searchVector),
    index('photo_metadata_zone_idx').on(t.zoneId),
    // The free zones to review (US-57)
    index('photo_metadata_zone_custom_idx')
      .on(t.zoneCustom)
      .where(sql`${t.zoneCustom} is not null`),
  ],
)

/** Tags of a capture (US-11.1), 10 at most (checked by the use case). */
export const photoTags = pgTable(
  'photo_tags',
  {
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.photoId, t.tagId] }), index('photo_tags_tag_idx').on(t.tagId)],
)
