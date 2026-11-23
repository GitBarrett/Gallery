import { validateUsername, type UsernameProblem } from '../../../../shared/domain/account-rules'
import { err, ok } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { invalid, type IdentityResult } from './email-tokens'
import type { IdentityRepository } from './ports'

const DAY_MS = 86_400_000
export const USERNAME_CHANGE_EVERY_MS = 30 * DAY_MS // US-05.4, 08-securite.md § 8
export const USERNAME_REDIRECT_MS = 90 * DAY_MS

export type UsernameAvailability = { available: true } | { available: false; reason: UsernameProblem | 'taken' }

/**
 * Live check of a username (US-05.2), open to everyone: usernames are public. A former name stays taken while it
 * redirects (90 days). shortcut: no rate limit on this read, like the public profile; add one if it is scraped.
 */
export const usernameAvailability =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { username: string }): Promise<UsernameAvailability> => {
    const valid = validateUsername(cmd.username)
    if (!valid.ok) return { available: false, reason: valid.error }
    const owner = await deps.repo.usernameOwner(cmd.username, deps.clock.now())
    return owner ? { available: false, reason: 'taken' } : { available: true }
  }

/**
 * Username change of the signed-in member (US-05.1, US-05.4): once every 30 days, the first one at any time. The
 * former name redirects to the profile for 90 days; its owner may take it back. A change of case only counts too.
 * shortcut: a concurrent change to the same name fails on the unique index (500), rare enough until it is seen.
 */
export const changeUsername =
  (deps: { uow: UnitOfWork<IdentityRepository>; clock: Clock }) =>
  async (cmd: { userId: string; username: string }): Promise<IdentityResult> => {
    const valid = validateUsername(cmd.username)
    if (!valid.ok) return err(invalid('username', valid.error))
    const at = deps.clock.now()
    return deps.uow.run(async (repo) => {
      const current = await repo.findUsername(cmd.userId)
      if (!current) return err({ kind: 'not_found' })
      const wait = (current.changedAt?.getTime() ?? 0) + USERNAME_CHANGE_EVERY_MS - at.getTime()
      if (wait > 0) return err({ kind: 'rate_limited', retryAfterSeconds: Math.ceil(wait / 1000) })
      const owner = await repo.usernameOwner(cmd.username, at)
      if (owner && owner !== cmd.userId) return err({ kind: 'taken', field: 'username' })
      await repo.renameUser({
        userId: cmd.userId,
        previous: current.username,
        username: cmd.username,
        at,
        redirectUntil: new Date(at.getTime() + USERNAME_REDIRECT_MS),
      })
      return ok(undefined)
    })
  }
