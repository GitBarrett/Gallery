import { err, ok } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { hashToken, invalid, type IdentityResult } from './email-tokens'
import type { IdentityRepository } from './ports'

/** Email verification (US-01.4), open to visitors: the token alone designates the account, once. */
export const verifyEmail =
  (deps: { uow: UnitOfWork<IdentityRepository>; clock: Clock }) =>
  async (cmd: { token: string }): Promise<IdentityResult> => {
    const tokenHash = await hashToken(cmd.token)
    const now = deps.clock.now()
    return deps.uow.run(async (repo) => {
      const token = await repo.findEmailToken(tokenHash, 'verify')
      if (!token || token.usedAt) return err(invalid('token', 'invalid'))
      if (token.expiresAt <= now) return err(invalid('token', 'expired'))
      if (!(await repo.useEmailToken(token.id, now))) return err(invalid('token', 'invalid'))
      await repo.markEmailVerified(token.userId, now)
      return ok(undefined)
    })
  }
