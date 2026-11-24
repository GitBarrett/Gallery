import { notificationPrefs, type NotificationPrefs } from '../../../../shared/domain/notification-prefs'
import { err, ok } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { hashToken, invalid, type IdentityResult } from './email-tokens'
import type { IdentityRepository, OAuthProviderName, PasswordHasher } from './ports'

// Every request counts, a wrong password included: it also stops guessing the password (same pace as US-01.5)
export const EMAIL_CHANGE_REQUESTS: RateLimitRule = { name: 'email-change', limit: 3, windowSeconds: 3600 }

/** Email, password hash (both null: Battle.net without email, Q55) and notification preferences of an account. */
export async function accountOf(repo: IdentityRepository, userId: string) {
  const recipient = await repo.findRecipient(userId)
  const passwordHash = recipient?.email ? (await repo.findCredentials(recipient.email))?.passwordHash : null
  return {
    email: recipient?.email ?? null,
    passwordHash: passwordHash ?? null,
    notificationPrefs: recipient?.notificationPrefs ?? notificationPrefs({}),
  }
}

/**
 * Email of the signed-in member, whether a password guards its change (US-07.2) and its linked providers (US-07.4),
 * own account only, with its notification preferences (US-07.5, Q69).
 */
export const getAccount =
  (deps: { repo: IdentityRepository }) =>
  async (cmd: {
    userId: string
  }): Promise<{
    email: string | null
    hasPassword: boolean
    providers: OAuthProviderName[]
    notificationPrefs: NotificationPrefs
  }> => {
    const { email, passwordHash, notificationPrefs: prefs } = await accountOf(deps.repo, cmd.userId)
    const providers = await deps.repo.listOAuthProviders(cmd.userId)
    return { email, hasPassword: Boolean(passwordHash), providers, notificationPrefs: prefs }
  }

/**
 * Email change of the signed-in member (US-07.2), any member with a session (08-securite.md annexe B, row "Compte").
 * The current password is asked when the account has one; a link goes to the new address, an alert to the old one,
 * and the email changes only once the link is opened. An address of another account gets the same answer and no
 * email (08-securite.md § 3: no enumeration).
 */
export const requestEmailChange =
  (deps: {
    repo: IdentityRepository
    uow: UnitOfWork<IdentityRepository>
    hasher: PasswordHasher
    limiter: RateLimiter
  }) =>
  async (cmd: { userId: string; newEmail: string; currentPassword?: string }): Promise<IdentityResult> => {
    const limit = await deps.limiter.consume(EMAIL_CHANGE_REQUESTS, cmd.userId)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const account = await accountOf(deps.repo, cmd.userId)
    if (account.passwordHash) {
      const { valid } = await deps.hasher.verify(cmd.currentPassword ?? '', account.passwordHash)
      if (!valid) return err(invalid('currentPassword', 'wrong'))
    }
    const owner = await deps.repo.findUserIdByEmail(cmd.newEmail)
    if (owner === cmd.userId) return err(invalid('newEmail', 'same'))
    if (owner) return ok(undefined)
    return deps.uow.run(async (_repo, publish) => {
      publish({ topic: 'emails', payload: { template: 'email_change', userId: cmd.userId, newEmail: cmd.newEmail } })
      if (account.email) publish({ topic: 'emails', payload: { template: 'email_change_alert', userId: cmd.userId } })
      return ok(undefined)
    })
  }

/**
 * Link of the email change (US-07.2), open to visitors: the token alone designates the account and the address, once.
 * The new email is verified; the other change, verification and reset links of the account stop working, so the old
 * mailbox can no longer reset the password. Signs nobody in.
 */
export const confirmEmailChange =
  (deps: { uow: UnitOfWork<IdentityRepository>; clock: Clock }) =>
  async (cmd: { token: string }): Promise<IdentityResult> => {
    const tokenHash = await hashToken(cmd.token)
    const now = deps.clock.now()
    return deps.uow.run(async (repo) => {
      const token = await repo.findEmailToken(tokenHash, 'email_change')
      if (!token?.newEmail || token.usedAt) return err(invalid('token', 'invalid'))
      if (token.expiresAt <= now) return err(invalid('token', 'expired'))
      // shortcut: two accounts confirming the same address at once, the second fails in 500 on the unique index (Q56)
      const owner = await repo.findUserIdByEmail(token.newEmail)
      if (owner && owner !== token.userId) return err(invalid('token', 'taken'))
      if (!(await repo.useEmailToken(token.id, now))) return err(invalid('token', 'invalid'))
      await repo.setEmail(token.userId, token.newEmail, now)
      for (const type of ['email_change', 'verify', 'reset'] as const)
        await repo.useEmailTokens(token.userId, type, now)
      return ok(undefined)
    })
  }
