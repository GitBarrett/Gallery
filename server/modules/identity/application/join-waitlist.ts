import { err, ok } from '../../../../shared/domain/result'
import type { IdGenerator } from '../../../platform/ids'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import { invalid, type IdentityResult } from './email-tokens'
import type { HumanVerifier, IdentityRepository, Locale } from './ports'

export const WAITLIST_PER_IP: RateLimitRule = { name: 'waitlist', limit: 3, windowSeconds: 3600 }

export interface JoinWaitlistCommand {
  email: string
  locale: Locale
  turnstileToken: string
  ip: string | undefined
}

/**
 * Waiting list of the beta (US-56.4), open to visitors while `features.inviteOnly` is on, not found after
 * (US-56.3). The same answer whether the email was already listed or not (no enumeration); no email is sent.
 */
export const joinWaitlist =
  (deps: {
    repo: IdentityRepository
    human: HumanVerifier
    limiter: RateLimiter
    ids: IdGenerator
    inviteOnly: () => Promise<boolean>
  }) =>
  async (cmd: JoinWaitlistCommand): Promise<IdentityResult> => {
    if (!(await deps.inviteOnly())) return err({ kind: 'not_found' })
    if (!(await deps.human.verify(cmd.turnstileToken, cmd.ip, 'waitlist')))
      return err(invalid('turnstileToken', 'failed'))
    const limit = await deps.limiter.consume(WAITLIST_PER_IP, cmd.ip ?? 'unknown')
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    await deps.repo.joinWaitlist({ id: deps.ids.next(), email: cmd.email, locale: cmd.locale })
    return ok(undefined)
  }
