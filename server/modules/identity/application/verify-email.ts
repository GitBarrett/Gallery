import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { hashToken, invalid, type IdentityError } from './email-tokens'
import type { IdentityRepository } from './ports'
import { startSession } from './sessions'

/**
 * Email verification (US-01.4), open to visitors: the token alone designates the account, once. Opening the link
 * signs its owner in (US-01.1, Q44): the sign-up itself opens no session, so it reveals nothing about the email.
 */
export const verifyEmail =
  (deps: { uow: UnitOfWork<IdentityRepository>; clock: Clock }) =>
  async (cmd: {
    token: string
    userAgent?: string
    previousSessionId?: string
  }): Promise<Result<{ sessionId: string }, IdentityError>> => {
    const tokenHash = await hashToken(cmd.token)
    const now = deps.clock.now()
    return deps.uow.run(async (repo) => {
      const token = await repo.findEmailToken(tokenHash, 'verify')
      if (!token || token.usedAt) return err(invalid('token', 'invalid'))
      if (token.expiresAt <= now) return err(invalid('token', 'expired'))
      if (!(await repo.useEmailToken(token.id, now))) return err(invalid('token', 'invalid'))
      await repo.markEmailVerified(token.userId, now)
      return ok({ sessionId: await startSession(repo, now, { ...cmd, userId: token.userId }) })
    })
  }
