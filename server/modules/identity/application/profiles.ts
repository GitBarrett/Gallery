import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdentityError } from './email-tokens'
import type { IdentityRepository } from './ports'
import { isEnded } from './sessions'

export interface PublicProfile {
  username: string
  bio: string | null
  memberSince: Date
}

/**
 * Public profile (US-05.3), open to everyone. A banned account or one being deleted is not found; a suspended one
 * stays visible. shortcut: no statistics until the photos exist (T-21+): every counter would be 0, hidden (US-70).
 */
export const getProfile =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { username: string }): Promise<Result<PublicProfile, IdentityError>> => {
    const found = (await deps.repo.findProfile(cmd.username)) ?? (await formerProfile(deps, cmd.username))
    if (!found || isEnded(found.status)) return err({ kind: 'not_found' })
    return ok({ username: found.username, bio: found.bio, memberSince: found.createdAt })
  }

// A former name for 90 days (US-05.4): the profile under its current name, the page redirects to it
async function formerProfile(deps: { repo: IdentityRepository; clock: Clock }, username: string) {
  const owner = await deps.repo.usernameOwner(username, deps.clock.now())
  const current = owner ? await deps.repo.findUsername(owner) : null
  return current ? deps.repo.findProfile(current.username) : null
}
