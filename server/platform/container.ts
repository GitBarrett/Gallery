import type { Db } from '../db/client'
import { outboxRelay, type QueueProducers } from '../db/outbox'
import { dbRateLimiter } from '../db/rate-limiter'
import { drizzleUnitOfWork } from '../db/unit-of-work'
import {
  argon2idHasher,
  drizzleIdentityRepository,
  fakeHumanVerifier,
  hibpBreachChecker,
  joinWaitlist,
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
    },
  }
}
