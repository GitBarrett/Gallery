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
  resolveSession,
  revokeOtherSessions,
  revokeSession,
  signin,
  signout,
  signup,
  turnstileVerifier,
  verifyEmail,
} from '../modules/identity'
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
}: {
  config: Config
  correlationId: string
  readSettings: (logger: Logger) => Promise<SiteSettings>
  /** Connection of the request, opened at the first use. */
  db?: () => Db
  queues?: QueueProducers
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
  // Registered as is with the provider (08-securite.md § 3)
  const redirectUri = (provider: OAuthProviderName) => `${config.siteUrl}/auth/${provider}/callback`

  return {
    config,
    clock,
    ids,
    logger,
    settings: () => readSettings(logger),
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
