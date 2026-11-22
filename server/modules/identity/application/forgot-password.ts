import { err, ok } from '../../../../shared/domain/result'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityResult } from './email-tokens'
import type { HumanVerifier, IdentityRepository } from './ports'
import { isEnded } from './sessions'

export const RESET_PER_IP: RateLimitRule = { name: 'password-reset-ip', limit: 10, windowSeconds: 3600 }
export const RESET_PER_EMAIL: RateLimitRule = { name: 'password-reset', limit: 3, windowSeconds: 3600 }

/**
 * Reset link request (US-04.1, US-04.4), open to visitors. The same answer whether the account exists, is ended,
 * or the request is over its limits (ignored silently): only the owner of the email learns anything, by email.
 * The link token is created by the `emails` consumer, at sending time.
 */
export const forgotPassword =
  (deps: {
    repo: IdentityRepository
    uow: UnitOfWork<IdentityRepository>
    human: HumanVerifier
    limiter: RateLimiter
  }) =>
  async (cmd: { email: string; turnstileToken: string; ip: string | undefined }): Promise<IdentityResult> => {
    if (!(await deps.human.verify(cmd.turnstileToken, cmd.ip, 'forgot_password')))
      return err(invalid('turnstileToken', 'failed'))
    for (const [rule, subject] of [
      [RESET_PER_IP, cmd.ip ?? 'unknown'],
      [RESET_PER_EMAIL, cmd.email.toLowerCase()],
    ] as const) {
      if (!(await deps.limiter.consume(rule, subject)).allowed) return ok(undefined)
    }
    const account = await deps.repo.findCredentials(cmd.email)
    if (!account || isEnded(account.status)) return ok(undefined)
    return deps.uow.run(async (_repo, publish) => {
      publish({ topic: 'emails', payload: { template: 'reset', userId: account.userId } })
      return ok(undefined)
    })
  }
