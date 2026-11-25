import { avatarPath } from '../../../../shared/domain/avatar-file'
import { validateBio } from '../../../../shared/domain/account-rules'
import type { NotificationPrefs } from '../../../../shared/domain/notification-prefs'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { socialLink, type SocialPlatform } from '../../../../shared/domain/social-links'
import type { Clock } from '../../../platform/clock'
import { invalid, type IdentityError, type IdentityResult } from './email-tokens'
import type { IdentityRepository, Locale } from './ports'
import { isEnded } from './sessions'
import { notSanctioned } from '../domain/policies'

export interface PublicProfile {
  username: string
  /** Base address of the avatar shown, `/64`, `/128` or `/256` appended (US-07.6); null: the initial. */
  avatarUrl: string | null
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
    return ok({
      username: found.username,
      avatarUrl: avatarPath(found.id, found.avatar),
      bio: found.bio,
      memberSince: found.createdAt,
      socialLinks,
    })
  }

// A former name for 90 days (US-05.4): the profile under its current name, the page redirects to it
async function formerProfile(deps: { repo: IdentityRepository; clock: Clock }, username: string) {
  const owner = await deps.repo.usernameOwner(username, deps.clock.now())
  const current = owner ? await deps.repo.findUsername(owner) : null
  return current ? deps.repo.findProfile(current.username) : null
}

/**
 * Bio, language and notification preferences of the signed-in member (US-07.1, US-07.5), saved at once; a field
 * left out keeps its value. A suspended member may not change their bio (08-securite.md annexe B), only the rest.
 */
export const updateProfile =
  (deps: { repo: IdentityRepository }) =>
  async (cmd: {
    actor: { id: string; status: string }
    bio?: string
    locale?: Locale
    notificationPrefs?: Partial<NotificationPrefs>
  }): Promise<IdentityResult> => {
    if (cmd.bio !== undefined) {
      const allowed = notSanctioned(cmd.actor)
      if (!allowed.ok) return allowed
    }
    const fields: Parameters<IdentityRepository['updateProfile']>[1] = {}
    if (cmd.locale) fields.locale = cmd.locale
    if (cmd.notificationPrefs) fields.notificationPrefs = cmd.notificationPrefs
    if (cmd.bio !== undefined) {
      const bio = validateBio(cmd.bio)
      if (!bio.ok) return err(invalid('bio', bio.error))
      fields.bio = bio.value
    }
    await deps.repo.updateProfile(cmd.actor.id, fields)
    return ok(undefined)
  }
