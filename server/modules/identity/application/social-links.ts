import { err, ok } from '../../../../shared/domain/result'
import { validateSocialHandle } from '../../../../shared/domain/social-links'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityResult } from './email-tokens'
import type { IdentityRepository, SocialLink } from './ports'

// 08-securite.md § 3: every save counts, refused or not
export const SOCIAL_LINKS_SAVES: RateLimitRule = { name: 'social-links', limit: 20, windowSeconds: 3600 }

type Actor = { id: string; username: string }

/**
 * Identifiers of the signed-in member, as stored (US-82.5: they stay in the settings even when the profile hides
 * them), in the fixed order of the networks. Own account only (08-securite.md annexe B, row "Compte").
 */
export const getSocialLinks =
  (deps: { repo: IdentityRepository }) =>
  async (cmd: { actor: Actor }): Promise<SocialLink[]> =>
    (await deps.repo.findProfile(cmd.actor.username))?.socialLinks ?? []

/**
 * Replaces all the social networks of the signed-in member (US-82.1–3), any member with a session, suspended
 * included (annexe B). Each identifier follows its network's format and the insult filter; nothing is saved when one
 * is refused, and the error names its network.
 */
export const setSocialLinks =
  (deps: { uow: UnitOfWork<IdentityRepository>; limiter: RateLimiter }) =>
  async (cmd: { actor: Actor; links: SocialLink[] }): Promise<IdentityResult> => {
    const limit = await deps.limiter.consume(SOCIAL_LINKS_SAVES, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    for (const { platform, handle } of cmd.links) {
      const valid = validateSocialHandle(platform, handle)
      if (!valid.ok) return err(invalid(platform, valid.error))
    }
    // One transaction: the repository deletes then inserts
    return deps.uow.run(async (repo) => {
      await repo.setSocialLinks(cmd.actor.id, cmd.links)
      return ok(undefined)
    })
  }
