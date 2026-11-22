import { err, ok } from '../../../../shared/domain/result'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityResult } from './email-tokens'
import type { Actor, HumanVerifier, IdentityRepository } from './ports'

export const RESEND_PER_ACCOUNT: RateLimitRule = { name: 'resend-verification', limit: 3, windowSeconds: 3600 }
export const RESEND_PER_IP: RateLimitRule = { name: 'resend-verification-ip', limit: 10, windowSeconds: 3600 }

/**
 * New verification link (US-01.5) for the signed-in member (08-securite.md annexe B): a new token is created when
 * the email is sent, the previous links stay valid until they expire. Nothing is sent to a verified email.
 */
export const resendVerification =
  (deps: { uow: UnitOfWork<IdentityRepository>; human: HumanVerifier; limiter: RateLimiter }) =>
  async (cmd: { actor: Actor; turnstileToken: string; ip: string | undefined }): Promise<IdentityResult> => {
    if (!(await deps.human.verify(cmd.turnstileToken, cmd.ip, 'resend_verification')))
      return err(invalid('turnstileToken', 'failed'))
    for (const [rule, subject] of [
      [RESEND_PER_IP, cmd.ip ?? 'unknown'],
      [RESEND_PER_ACCOUNT, cmd.actor.id],
    ] as const) {
      const limit = await deps.limiter.consume(rule, subject)
      if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    }
    if (cmd.actor.emailVerified) return ok(undefined)
    return deps.uow.run(async (_repo, publish) => {
      publish({ topic: 'emails', payload: { template: 'verify', userId: cmd.actor.id } })
      return ok(undefined)
    })
  }
