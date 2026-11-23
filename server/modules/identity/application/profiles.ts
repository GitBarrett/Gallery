import { err, ok, type Result } from '../../../../shared/domain/result'
import { socialLink, type SocialPlatform } from '../../../../shared/domain/social-links'
import type { Clock } from '../../../platform/clock'
import type { IdentityError } from './email-tokens'
import type { IdentityRepository } from './ports'
import { isEnded } from './sessions'

export interface PublicProfile {
  username: string
  bio: string | null
  memberSince: Date
  /** Built by the server from the fixed templates (US-82.4); `url` null for Discord, copied instead. */
  socialLinks: { platform: SocialPlatform; label: string; url: string | null }[]
}

const LINKS_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // anti-spam: no links on an account under 7 days old (US-82.5)

/**
 * Public profile (US-05.3), open to everyone. A banned account or one being deleted is not found; a suspended one
 * stays visible. shortcut: no statistics until the photos exist (T-21+): every counter would be 0, hidden (US-70).
 */
export const getProfile =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { username: string }): Promise<Result<PublicProfile, IdentityError>> => {
    const found = (await deps.repo.findProfile(cmd.username)) ?? (await formerProfile(deps, cmd.username))
    if (!found || isEnded(found.status)) return err({ kind: 'not_found' })
    const hidden =
      found.status === 'suspended' || deps.clock.now().getTime() - found.createdAt.getTime() < LINKS_AFTER_MS
    const socialLinks = hidden
      ? []
      : found.socialLinks.flatMap(({ platform, handle }) => {
          const link = socialLink(platform, handle)
          return link ? [{ platform, ...link }] : []
        })
    return ok({ username: found.username, bio: found.bio, memberSince: found.createdAt, socialLinks })
  }

// A former name for 90 days (US-05.4): the profile under its current name, the page redirects to it
async function formerProfile(deps: { repo: IdentityRepository; clock: Clock }, username: string) {
  const owner = await deps.repo.usernameOwner(username, deps.clock.now())
  const current = owner ? await deps.repo.findUsername(owner) : null
  return current ? deps.repo.findProfile(current.username) : null
}
