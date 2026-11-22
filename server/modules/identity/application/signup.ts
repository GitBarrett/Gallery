import { validatePassword, validateUsername } from '../../../../shared/domain/account-rules'
import { err, ok } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityResult } from './email-tokens'
import type { BreachChecker, HumanVerifier, IdentityRepository, Locale, PasswordHasher } from './ports'

/** Date of docs/legal/terms.md. shortcut: constant until the versioned Terms of T-70 (site_settings.legal) */
export const TERMS_VERSION = '2026-11-22'
export const SIGNUP_PER_IP: RateLimitRule = { name: 'signup', limit: 3, windowSeconds: 3600 }

export interface SignupCommand {
  email: string
  username: string
  password: string
  turnstileToken: string
  locale: Locale
  ip: string | undefined
}

/**
 * Sign-up (US-01), open to visitors. A used email gets the same answer as a new one (no enumeration): its owner
 * is told by email instead. The username is public, so "taken" is reported, before looking at the email.
 */
export const signup =
  (deps: {
    uow: UnitOfWork<IdentityRepository>
    hasher: PasswordHasher
    human: HumanVerifier
    breaches: BreachChecker
    limiter: RateLimiter
    ids: IdGenerator
    clock: Clock
  }) =>
  async (cmd: SignupCommand): Promise<IdentityResult> => {
    const human = await deps.human.verify(cmd.turnstileToken, cmd.ip, 'signup')
    if (!human) return err(invalid('turnstileToken', 'failed'))
    const limit = await deps.limiter.consume(SIGNUP_PER_IP, cmd.ip ?? 'unknown')
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const username = validateUsername(cmd.username)
    if (!username.ok) return err(invalid('username', username.error))
    const password = validatePassword(cmd.password)
    if (!password.ok) return err(invalid('password', password.error))
    if (await deps.breaches.isBreached(cmd.password)) return err(invalid('password', 'breached'))
    const passwordHash = await deps.hasher.hash(cmd.password) // even for a used email: same response time

    return deps.uow.run(async (repo, publish) => {
      if (await repo.usernameTaken(username.value)) return err({ kind: 'taken', field: 'username' })
      const existing = await repo.findUserIdByEmail(cmd.email)
      if (existing) {
        publish({ topic: 'emails', payload: { template: 'account_exists', userId: existing } })
        return ok(undefined)
      }
      const id = deps.ids.next()
      const created = await repo.createUser({
        id,
        email: cmd.email,
        username: username.value,
        passwordHash,
        locale: cmd.locale,
        termsAcceptedAt: deps.clock.now(),
        termsVersion: TERMS_VERSION,
      })
      if (created === 'username_taken') return err({ kind: 'taken', field: 'username' })
      // email_taken: a concurrent sign-up of the same email won; answered like any used email
      if (created === 'created') publish({ topic: 'emails', payload: { template: 'verify', userId: id } })
      return ok(undefined)
    })
  }
