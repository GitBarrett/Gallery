import type { Db } from '../db/client'
import { outboxRelay, type QueueProducers } from '../db/outbox'
import { dbRateLimiter } from '../db/rate-limiter'
import { drizzleUnitOfWork } from '../db/unit-of-work'
import {
  argon2idHasher,
  battlenetOAuthProvider,
  completeOAuthSignup,
  fakeOAuthProvider,
  googleOAuthProvider,
  oauthCallback,
  type OAuthProviderName,
  startOAuth,
  drizzleIdentityRepository,
  fakeHumanVerifier,
  forgotPassword,
  changeUsername,
  getProfile,
  updateProfile,
  hibpBreachChecker,
  joinWaitlist,
  listSessions,
  resendVerification,
  usernameAvailability,
  resetPassword,
  changePassword,
  aesGcmSecretBox,
  startMfaSetup,
  verifyMfa,
  challengeMfa,
  getSocialLinks,
  setSocialLinks,
  getAccount,
  requestEmailChange,
  confirmEmailChange,
  unlinkOAuth,
  resolveSession,
  revokeOtherSessions,
  revokeSession,
  signin,
  signout,
  signup,
  turnstileVerifier,
  verifyEmail,
} from '../modules/identity'
import {
  drizzleCatalogRepository,
  ensureTags,
  findZone,
  tagSlugs,
  zoneById,
  listGameVersions,
  suggestTags,
  suggestZones,
} from '../modules/catalog'
import { browseGrid, drizzleGalleryRepository } from '../modules/gallery'
import {
  completeUpload,
  drizzleMediaRepository,
  memoryBucket,
  r2ObjectStorage,
  requestUploadUrl,
  serveImage,
  listMyCaptures,
  getMyCapture,
  requestAvatarUpload,
  completeAvatarUpload,
  serveAvatar,
  editCapture,
  deleteCapture,
  cloudflareCachePurger,
  type R2Bucket,
} from '../modules/media'
import {
  drizzleNotificationsRepository,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from '../modules/notifications'
import type { SiteSettings } from '../modules/settings'
import { systemClock, type Clock } from './clock'
import type { Config } from './config'
import { uuidV7Generator, type IdGenerator } from './ids'
import { createLogger, type Logger } from './logger'

type UseCase<F extends (deps: never) => unknown> = ReturnType<F>

/** Composition root: builds, per request, the dependencies of the use cases (10-clean-architecture.md § 5). */
export interface Container {
  config: Config
  clock: Clock
  ids: IdGenerator
  logger: Logger
  catalog: {
    listGameVersions: UseCase<typeof listGameVersions>
    suggestTags: UseCase<typeof suggestTags>
    suggestZones: UseCase<typeof suggestZones>
  }
  gallery: {
    browseGrid: UseCase<typeof browseGrid>
  }
  media: {
    requestUploadUrl: UseCase<typeof requestUploadUrl>
    completeUpload: UseCase<typeof completeUpload>
    serveImage: UseCase<typeof serveImage>
    listMyCaptures: UseCase<typeof listMyCaptures>
    getMyCapture: UseCase<typeof getMyCapture>
    requestAvatarUpload: UseCase<typeof requestAvatarUpload>
    completeAvatarUpload: UseCase<typeof completeAvatarUpload>
    serveAvatar: UseCase<typeof serveAvatar>
    editCapture: UseCase<typeof editCapture>
    deleteCapture: UseCase<typeof deleteCapture>
  }
  notifications: {
    list: UseCase<typeof listNotifications>
    unreadCount: UseCase<typeof unreadCount>
    markRead: UseCase<typeof markRead>
    markAllRead: UseCase<typeof markAllRead>
  }
  /** Site settings, cached 60 s per isolate (settings module). */
  settings: () => Promise<SiteSettings>
  identity: {
    signup: UseCase<typeof signup>
    verifyEmail: UseCase<typeof verifyEmail>
    joinWaitlist: UseCase<typeof joinWaitlist>
    signin: UseCase<typeof signin>
    signout: UseCase<typeof signout>
    resolveSession: UseCase<typeof resolveSession>
    listSessions: UseCase<typeof listSessions>
    revokeSession: UseCase<typeof revokeSession>
    revokeOtherSessions: UseCase<typeof revokeOtherSessions>
    resendVerification: UseCase<typeof resendVerification>
    forgotPassword: UseCase<typeof forgotPassword>
    resetPassword: UseCase<typeof resetPassword>
    changePassword: UseCase<typeof changePassword>
    startMfaSetup: UseCase<typeof startMfaSetup>
    verifyMfa: UseCase<typeof verifyMfa>
    challengeMfa: UseCase<typeof challengeMfa>
    getSocialLinks: UseCase<typeof getSocialLinks>
    setSocialLinks: UseCase<typeof setSocialLinks>
    getAccount: UseCase<typeof getAccount>
    requestEmailChange: UseCase<typeof requestEmailChange>
    confirmEmailChange: UseCase<typeof confirmEmailChange>
    unlinkOAuth: UseCase<typeof unlinkOAuth>
    getProfile: UseCase<typeof getProfile>
    updateProfile: UseCase<typeof updateProfile>
    changeUsername: UseCase<typeof changeUsername>
    usernameAvailability: UseCase<typeof usernameAvailability>
    startOAuth: (provider: OAuthProviderName) => ReturnType<typeof startOAuth>
    oauthCallback: UseCase<typeof oauthCallback>
    completeOAuthSignup: UseCase<typeof completeOAuthSignup>
  }
}

// Rate limiting key of local runs and previews without the secret: their counters are throwaway
const FAKE_IP_HASH_KEY = 'fake-providers-ip-hash-key-not-secret'
// TOTP secrets of local runs and previews without the secret: test accounts only
const FAKE_MFA_KEY = 'fake-providers-mfa-key-not-secret'

// Presigned URLs of local runs and previews without the S3 token: refused by R2, enough for the API tests
const FAKE_S3 = {
  accountId: '0'.repeat(32),
  bucket: 'ls-local',
  accessKeyId: 'fake',
  secretAccessKey: 'fake-not-secret',
}
// Node test server and local runs without the R2 binding (fake providers only)
const localBucket = memoryBucket()

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function createContainer({
  config,
  correlationId,
  readSettings,
  db = () => {
    throw new Error('no database in this environment')
  },
  queues = {} as QueueProducers,
  bucket,
}: {
  config: Config
  correlationId: string
  readSettings: (logger: Logger) => Promise<SiteSettings>
  /** Connection of the request, opened at the first use. */
  db?: () => Db
  queues?: QueueProducers
  /** R2 binding, absent in Node runs. */
  bucket?: R2Bucket
}): Container {
  const logger = createLogger({ correlationId })
  const clock = systemClock
  const ids = uuidV7Generator(clock)
  const fetcher = (url: string, init?: RequestInit) => fetch(url, init)
  const identityUow = () => drizzleUnitOfWork(db(), drizzleIdentityRepository, outboxRelay(db(), queues, clock), logger)
  const ipHashKey = () =>
    config.ipHashKey ?? (config.fakeProviders ? FAKE_IP_HASH_KEY : required(undefined, 'IP_HASH_KEY_CURRENT'))
  const human = () =>
    config.fakeProviders
      ? fakeHumanVerifier
      : turnstileVerifier({
          secret: required(config.turnstileSecret, 'TURNSTILE_SECRET_KEY'),
          hostname: new URL(config.siteUrl).hostname,
          fetch: fetcher,
        })
  const inviteOnly = async () => (await readSettings(logger))['features.inviteOnly']
  const oauthProvider = (provider: OAuthProviderName) =>
    config.fakeProviders
      ? fakeOAuthProvider(required(config.fakeOAuthConsentUrl, 'NUXT_FAKE_OAUTH_CONSENT_URL'), provider)
      : provider === 'battlenet'
        ? battlenetOAuthProvider({
            clientId: required(config.battlenetClientId, 'NUXT_OAUTH_BATTLEDOTNET_CLIENT_ID'),
            clientSecret: required(config.battlenetClientSecret, 'NUXT_OAUTH_BATTLEDOTNET_CLIENT_SECRET'),
            fetch: fetcher,
          })
        : googleOAuthProvider({
            clientId: required(config.googleClientId, 'NUXT_OAUTH_GOOGLE_CLIENT_ID'),
            clientSecret: required(config.googleClientSecret, 'NUXT_OAUTH_GOOGLE_CLIENT_SECRET'),
            fetch: fetcher,
          })
  const mfaDeps = () => ({
    repo: drizzleIdentityRepository(db()),
    uow: identityUow(),
    box: aesGcmSecretBox(
      config.mfaKey ?? (config.fakeProviders ? FAKE_MFA_KEY : required(undefined, 'MFA_ENCRYPTION_KEY')),
    ),
    limiter: dbRateLimiter(db(), ipHashKey(), clock),
    clock,
  })
  // Private bucket; a missing token or binding only fails the uploads (Q42)
  const storage = () => {
    const { r2AccountId: accountId, r2Bucket: name, r2AccessKeyId: accessKeyId, r2SecretAccessKey: secret } = config
    const credentials =
      accountId && name && accessKeyId && secret
        ? { accountId, bucket: name, accessKeyId, secretAccessKey: secret }
        : config.fakeProviders
          ? FAKE_S3
          : undefined
    if (!bucket && !config.fakeProviders) throw new Error('R2 is not bound')
    return r2ObjectStorage({ bucket: bucket ?? localBucket, prefix: config.r2Prefix, credentials, now: clock.now })
  }
  // Registered as is with the provider (08-securite.md § 3)
  const redirectUri = (provider: OAuthProviderName) => `${config.siteUrl}/auth/${provider}/callback`

  return {
    config,
    clock,
    ids,
    logger,
    settings: () => readSettings(logger),
    gallery: {
      browseGrid: (cmd) =>
        browseGrid({
          repo: drizzleGalleryRepository(db()),
          gameVersions: listGameVersions({ repo: drizzleCatalogRepository(db()) }),
          zoneOf: findZone({ repo: drizzleCatalogRepository(db()) }),
          thresholds: async () => (await readSettings(logger))['quality.thresholds'],
        })(cmd),
    },
    media: {
      serveImage: (cmd) => serveImage({ repo: drizzleMediaRepository(db()), storage: storage() })(cmd),
      listMyCaptures: (cmd) => listMyCaptures({ repo: drizzleMediaRepository(db()) })(cmd),
      getMyCapture: (cmd) =>
        getMyCapture({
          repo: drizzleMediaRepository(db()),
          zoneById: zoneById({ repo: drizzleCatalogRepository(db()) }),
          tagSlugs: tagSlugs({ repo: drizzleCatalogRepository(db()) }),
        })(cmd),
      // US-07.6: the avatar versions live on the account (identity)
      requestAvatarUpload: (cmd) =>
        requestAvatarUpload({
          accounts: drizzleIdentityRepository(db()),
          storage: storage(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          ids,
          clock,
        })(cmd),
      completeAvatarUpload: (cmd) =>
        completeAvatarUpload({
          accounts: drizzleIdentityRepository(db()),
          uow: drizzleUnitOfWork(db(), () => ({}), outboxRelay(db(), queues, clock), logger),
          storage: storage(),
        })(cmd),
      serveAvatar: (cmd) => serveAvatar({ accounts: drizzleIdentityRepository(db()), storage: storage() })(cmd),
      editCapture: (cmd) =>
        editCapture({
          repo: drizzleMediaRepository(db()),
          zoneOf: findZone({ repo: drizzleCatalogRepository(db()) }),
          tagIdsOf: ensureTags({ repo: drizzleCatalogRepository(db()) }),
        })(cmd),
      deleteCapture: (cmd) =>
        deleteCapture({
          repo: drizzleMediaRepository(db()),
          storage: storage(),
          purger: cloudflareCachePurger({ token: config.cfApiTokenPurge, zoneId: config.cfZoneId, fetch: fetcher }),
          siteUrl: config.siteUrl,
        })(cmd),
      requestUploadUrl: (cmd) =>
        requestUploadUrl({
          repo: drizzleMediaRepository(db()),
          storage: storage(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          ids,
          clock,
        })(cmd),
      completeUpload: (cmd) =>
        completeUpload({
          repo: drizzleMediaRepository(db()),
          uow: drizzleUnitOfWork(db(), drizzleMediaRepository, outboxRelay(db(), queues, clock), logger),
          storage: storage(),
          gameVersions: listGameVersions({ repo: drizzleCatalogRepository(db()) }),
          zoneOf: findZone({ repo: drizzleCatalogRepository(db()) }),
          tagIdsOf: ensureTags({ repo: drizzleCatalogRepository(db()) }),
          clock,
        })(cmd),
    },
    notifications: {
      list: (cmd) =>
        listNotifications({
          repo: drizzleNotificationsRepository(db()),
          usernames: (ids) => drizzleIdentityRepository(db()).usernames(ids),
          titles: (ids) => drizzleMediaRepository(db()).titles(ids),
        })(cmd),
      unreadCount: (cmd) => unreadCount({ repo: drizzleNotificationsRepository(db()) })(cmd),
      markRead: (cmd) => markRead({ repo: drizzleNotificationsRepository(db()), clock })(cmd),
      markAllRead: (cmd) => markAllRead({ repo: drizzleNotificationsRepository(db()), clock })(cmd),
    },
    catalog: {
      listGameVersions: () => listGameVersions({ repo: drizzleCatalogRepository(db()) })(),
      suggestTags: (cmd) => suggestTags({ repo: drizzleCatalogRepository(db()) })(cmd),
      suggestZones: (cmd) => suggestZones({ repo: drizzleCatalogRepository(db()) })(cmd),
    },
    identity: {
      signup: (cmd) =>
        signup({
          uow: identityUow(),
          hasher: argon2idHasher(),
          breaches: hibpBreachChecker({ fetch: fetcher, logger }),
          human: human(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          ids,
          clock,
          inviteOnly,
        })(cmd),
      verifyEmail: (cmd) => verifyEmail({ uow: identityUow(), clock })(cmd),
      joinWaitlist: (cmd) =>
        joinWaitlist({
          repo: drizzleIdentityRepository(db()),
          human: human(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          ids,
          inviteOnly,
        })(cmd),
      signin: (cmd) =>
        signin({
          repo: drizzleIdentityRepository(db()),
          uow: identityUow(),
          hasher: argon2idHasher(),
          human: human(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          clock,
          ids,
        })(cmd),
      signout: (cmd) => signout({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      // Read through Hyperdrive without cache (ADR-016): a revoked session is refused at once
      resolveSession: (cmd) => resolveSession({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      listSessions: (cmd) => listSessions({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      revokeSession: (cmd) => revokeSession({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      revokeOtherSessions: (cmd) => revokeOtherSessions({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      getProfile: (cmd) => getProfile({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      updateProfile: (cmd) => updateProfile({ repo: drizzleIdentityRepository(db()) })(cmd),
      changeUsername: (cmd) => changeUsername({ uow: identityUow(), clock })(cmd),
      usernameAvailability: (cmd) => usernameAvailability({ repo: drizzleIdentityRepository(db()), clock })(cmd),
      resendVerification: (cmd) =>
        resendVerification({ uow: identityUow(), human: human(), limiter: dbRateLimiter(db(), ipHashKey(), clock) })(
          cmd,
        ),
      forgotPassword: (cmd) =>
        forgotPassword({
          repo: drizzleIdentityRepository(db()),
          uow: identityUow(),
          human: human(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
        })(cmd),
      resetPassword: (cmd) =>
        resetPassword({
          uow: identityUow(),
          hasher: argon2idHasher(),
          breaches: hibpBreachChecker({ fetch: fetcher, logger }),
          clock,
        })(cmd),
      changePassword: (cmd) =>
        changePassword({
          repo: drizzleIdentityRepository(db()),
          uow: identityUow(),
          hasher: argon2idHasher(),
          breaches: hibpBreachChecker({ fetch: fetcher, logger }),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          clock,
        })(cmd),
      startMfaSetup: (cmd) => startMfaSetup(mfaDeps())(cmd),
      verifyMfa: (cmd) => verifyMfa(mfaDeps())(cmd),
      challengeMfa: (cmd) => challengeMfa(mfaDeps())(cmd),
      getSocialLinks: (cmd) => getSocialLinks({ repo: drizzleIdentityRepository(db()) })(cmd),
      setSocialLinks: (cmd) =>
        setSocialLinks({ uow: identityUow(), limiter: dbRateLimiter(db(), ipHashKey(), clock) })(cmd),
      getAccount: (cmd) => getAccount({ repo: drizzleIdentityRepository(db()) })(cmd),
      requestEmailChange: (cmd) =>
        requestEmailChange({
          repo: drizzleIdentityRepository(db()),
          uow: identityUow(),
          hasher: argon2idHasher(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
        })(cmd),
      confirmEmailChange: (cmd) => confirmEmailChange({ uow: identityUow(), clock })(cmd),
      unlinkOAuth: (cmd) => unlinkOAuth({ uow: identityUow() })(cmd),
      startOAuth: (provider) => startOAuth(oauthProvider(provider), redirectUri(provider)),
      oauthCallback: (cmd) =>
        oauthCallback({
          repo: drizzleIdentityRepository(db()),
          provider: oauthProvider(cmd.provider),
          clock,
          logger,
          redirectUri: redirectUri(cmd.provider),
        })(cmd),
      completeOAuthSignup: (cmd) =>
        completeOAuthSignup({
          uow: identityUow(),
          limiter: dbRateLimiter(db(), ipHashKey(), clock),
          ids,
          clock,
          inviteOnly,
        })(cmd),
    },
  }
}
