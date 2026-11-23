import { err, ok } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { AttemptCounter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { hashToken, invalid, type IdentityResult } from './email-tokens'
import type { BreachChecker, IdentityRepository, PasswordHasher } from './ports'
import { newPasswordHash } from './reset-password'

// A stolen session must not guess the old password (same pace as the sign-in, 08-securite.md § 3), per account
export const PASSWORD_CHANGE_FAILURES: RateLimitRule = {
  name: 'password-change-failures',
  limit: 5,
  windowSeconds: 900,
}

/**
 * New password of the signed-in member (US-07.3), any member with a session (08-securite.md annexe B, row
 * "Compte"). The old password proves the owner; an account without one (OAuth) sets it with a reset link (Q52).
 * Every other session ends, the current one stays.
 */
export const changePassword =
  (deps: {
    repo: IdentityRepository
    uow: UnitOfWork<IdentityRepository>
    hasher: PasswordHasher
    breaches: BreachChecker
    limiter: AttemptCounter
    clock: Clock
  }) =>
  async (cmd: {
    userId: string
    sessionId: string
    currentPassword: string
    password: string
  }): Promise<IdentityResult> => {
    const limit = await deps.limiter.peek(PASSWORD_CHANGE_FAILURES, cmd.userId)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    // An account without email has no password either (OAuth without a verified email)
    const email = (await deps.repo.findRecipient(cmd.userId))?.email
    const stored = email ? (await deps.repo.findCredentials(email))?.passwordHash : null
    if (!stored) return err(invalid('currentPassword', 'none'))
    if (!(await deps.hasher.verify(cmd.currentPassword, stored)).valid) {
      await deps.limiter.consume(PASSWORD_CHANGE_FAILURES, cmd.userId)
      return err(invalid('currentPassword', 'wrong'))
    }
    const hashed = await newPasswordHash(deps, cmd.password)
    if (!hashed.ok) return hashed
    const now = deps.clock.now()
    const kept = await hashToken(cmd.sessionId)
    return deps.uow.run(async (repo) => {
      await repo.setPasswordHash(cmd.userId, hashed.value)
      await repo.revokeOtherSessions(cmd.userId, kept, now)
      return ok(undefined)
    })
  }
