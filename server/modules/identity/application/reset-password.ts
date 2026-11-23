import { validatePassword } from '../../../../shared/domain/account-rules'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { hashToken, invalid, type IdentityError } from './email-tokens'
import type { BreachChecker, IdentityRepository, PasswordHasher } from './ports'
import { startSession } from './sessions'

/** Sign-up rules, then the breach check (08-securite.md § 3), then the hash of a new password. */
export async function newPasswordHash(
  deps: { hasher: PasswordHasher; breaches: BreachChecker },
  password: string,
): Promise<Result<string, IdentityError>> {
  const valid = validatePassword(password)
  if (!valid.ok) return err(invalid('password', valid.error))
  if (await deps.breaches.isBreached(password)) return err(invalid('password', 'breached'))
  return ok(await deps.hasher.hash(password))
}

/**
 * New password from a reset link (US-04.2–3), open to visitors: the token alone designates the account, once. The
 * password is checked before the token is used, so a refused password leaves the link usable. Every session of the
 * account ends, the current one included, then its owner is signed in again and told by email (US-04.6).
 */
export const resetPassword =
  (deps: { uow: UnitOfWork<IdentityRepository>; hasher: PasswordHasher; breaches: BreachChecker; clock: Clock }) =>
  async (cmd: {
    token: string
    password: string
    userAgent?: string
    previousSessionId?: string
  }): Promise<Result<{ sessionId: string }, IdentityError>> => {
    const hashed = await newPasswordHash(deps, cmd.password)
    if (!hashed.ok) return hashed
    const passwordHash = hashed.value
    const tokenHash = await hashToken(cmd.token)
    const now = deps.clock.now()
    return deps.uow.run(async (repo, publish) => {
      const token = await repo.findEmailToken(tokenHash, 'reset')
      if (!token || token.usedAt) return err(invalid('token', 'invalid'))
      if (token.expiresAt <= now) return err(invalid('token', 'expired'))
      if (!(await repo.useEmailToken(token.id, now))) return err(invalid('token', 'invalid'))
      await repo.setPasswordHash(token.userId, passwordHash)
      // US-04.5: the other links stop working; opening this one proves the owner reads the mailbox
      await repo.useEmailTokens(token.userId, 'reset', now)
      await repo.markEmailVerified(token.userId, now)
      publish({ topic: 'emails', payload: { template: 'password_changed', userId: token.userId } }) // US-04.6
      const sessionId = await startSession(repo, now, { ...cmd, userId: token.userId })
      await repo.revokeOtherSessions(token.userId, await hashToken(sessionId), now)
      return ok({ sessionId })
    })
  }
