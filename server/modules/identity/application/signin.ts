import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { AttemptCounter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityError } from './email-tokens'
import type { IdGenerator } from '../../../platform/ids'
import type { PendingOAuth } from './oauth'
import type { HumanVerifier, IdentityRepository, PasswordHasher } from './ports'
import { isEnded, startSession } from './sessions'

export interface SigninCommand {
  email: string
  password: string
  /** Required after repeated failures (US-03.3). */
  turnstileToken?: string
  ip?: string
  userAgent?: string
  /** Session of the browser before signing in, revoked (new id at every sign-in). */
  previousSessionId?: string
  /** OAuth identity waiting for this sign-in to link it, when its email is the account's (US-02.3). */
  oauthLink?: PendingOAuth
}

// Failures counted per email (existing or not: no enumeration) and per IP (08-securite.md § 3 and § 8).
// shortcut: fixed windows, so "blocked 1 h" lasts until the end of the current hour; sliding windows if it matters
export const SIGNIN_FAILURES: RateLimitRule = { name: 'signin-failures', limit: 5, windowSeconds: 900 }
export const SIGNIN_FAILURES_IP: RateLimitRule = { name: 'signin-failures-ip', limit: 5, windowSeconds: 900 }
export const SIGNIN_BLOCK: RateLimitRule = { name: 'signin-block', limit: 20, windowSeconds: 3600 }

const refused = err({ kind: 'invalid_credentials' } as const)
// Verified when there is no real hash; created once per isolate (the use case itself is built per request)
let dummyHash: Promise<string> | undefined

type Deps = {
  repo: IdentityRepository
  uow: UnitOfWork<IdentityRepository>
  hasher: PasswordHasher
  human: HumanVerifier
  limiter: AttemptCounter
  clock: Clock
  ids: IdGenerator
}

/** Lockout before checking the password: blocked account, then Turnstile after 5 failures (US-03.3). */
async function lockout(deps: Deps, cmd: SigninCommand, account: string): Promise<IdentityError | undefined> {
  const blocked = await deps.limiter.peek(SIGNIN_BLOCK, account)
  if (!blocked.allowed) return { kind: 'rate_limited', retryAfterSeconds: blocked.retryAfterSeconds }
  const byAccount = await deps.limiter.peek(SIGNIN_FAILURES, account)
  const byIp = await deps.limiter.peek(SIGNIN_FAILURES_IP, cmd.ip ?? 'unknown')
  if (byAccount.allowed && byIp.allowed) return undefined
  if (!cmd.turnstileToken) return invalid('turnstileToken', 'required')
  if (!(await deps.human.verify(cmd.turnstileToken, cmd.ip, 'signin'))) return invalid('turnstileToken', 'failed')
  return undefined
}

/** Counts a failure; the one that blocks the account tells its owner, once (the next attempts stop at lockout). */
async function countFailure(deps: Deps, cmd: SigninCommand, account: string, userId: string | undefined) {
  await deps.limiter.consume(SIGNIN_FAILURES, account)
  await deps.limiter.consume(SIGNIN_FAILURES_IP, cmd.ip ?? 'unknown')
  await deps.limiter.consume(SIGNIN_BLOCK, account)
  if (userId && !(await deps.limiter.peek(SIGNIN_BLOCK, account)).allowed)
    await deps.uow.run(async (_repo, publish) =>
      publish({ topic: 'emails', payload: { template: 'signin_locked', userId } }),
    )
}

/** Links the pending OAuth identity whose email is the account's (US-02.3); another one stays pending. */
async function linkPending(deps: Deps, link: PendingOAuth | undefined, accountKey: string, userId: string) {
  if (link?.email?.toLowerCase() !== accountKey) return
  await deps.repo.linkOAuthAccount({ id: deps.ids.next(), userId, provider: link.provider, subject: link.subject })
}

/**
 * Password sign-in (US-03.1–3), open to visitors. One answer for an unknown email, a wrong password, an account
 * without password (OAuth) or an ended one; a hash is verified in every case, so the time is the same too.
 */
export const signin =
  (deps: Deps) =>
  async (cmd: SigninCommand): Promise<Result<{ sessionId: string }, IdentityError>> => {
    const accountKey = cmd.email.toLowerCase()
    const locked = await lockout(deps, cmd, accountKey)
    if (locked) return err(locked)
    const account = await deps.repo.findCredentials(cmd.email)
    const stored = account?.passwordHash ?? (await (dummyHash ??= deps.hasher.hash('no account, same work')))
    const { valid } = await deps.hasher.verify(cmd.password, stored)
    if (!account?.passwordHash || !valid || isEnded(account.status)) {
      await countFailure(deps, cmd, accountKey, account?.userId)
      return refused
    }
    await linkPending(deps, cmd.oauthLink, accountKey, account.userId)
    const sessionId = await startSession(deps.repo, deps.clock.now(), { ...cmd, userId: account.userId })
    return ok({ sessionId })
  }
