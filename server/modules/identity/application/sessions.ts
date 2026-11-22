import type { Clock } from '../../../platform/clock'
import { hashToken, newToken } from './email-tokens'
import type { Actor, IdentityRepository } from './ports'

/** 30 days, sliding (US-03.1); staff sessions (12 h) come with the MFA of T-18b. */
export const SESSION_TTL_MS = 30 * 86_400_000
// The sliding expiry is written at most once an hour per session, not at every request
const TOUCH_MS = 3_600_000
/** Accounts whose sessions end and which cannot sign in (US-03.5). */
export const isEnded = (status: string) => ['banned', 'pending_deletion'].includes(status)

/**
 * Opens a session for `userId` and returns its id (256 random bits, only the hash is stored). The session the
 * browser had is revoked: a new id at every sign-in (anti-fixation, 08-securite.md § 3).
 */
export async function startSession(
  repo: IdentityRepository,
  now: Date,
  opts: { userId: string; userAgent?: string; previousSessionId?: string },
): Promise<string> {
  if (opts.previousSessionId) await repo.revokeSession(await hashToken(opts.previousSessionId), now)
  const id = newToken()
  await repo.createSession({
    idHash: await hashToken(id),
    userId: opts.userId,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    userAgentSummary: opts.userAgent?.slice(0, 200) ?? null,
  })
  return id
}

/**
 * Member of a session id, checked at each request (ADR-010): null when unknown, revoked or expired. The session
 * of a banned or deleted account is revoked (US-03.5). `refreshed`: the 30 days restarted, reseal the cookie.
 */
export const resolveSession =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { sessionId: string }): Promise<{ actor: Actor; refreshed: boolean } | null> => {
    const idHash = await hashToken(cmd.sessionId)
    const session = await deps.repo.findSession(idHash)
    const now = deps.clock.now()
    if (!session || session.revokedAt || session.expiresAt <= now) return null
    if (isEnded(session.account.status)) {
      await deps.repo.revokeSession(idHash, now)
      return null
    }
    const refreshed = now.getTime() - session.lastSeenAt.getTime() >= TOUCH_MS
    if (refreshed) await deps.repo.touchSession(idHash, now, new Date(now.getTime() + SESSION_TTL_MS))
    return { actor: session.account, refreshed }
  }

/** Sign-out (US-03.4): the session is revoked server side, a copy of the cookie is useless. */
export const signout =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { sessionId: string }): Promise<void> =>
    deps.repo.revokeSession(await hashToken(cmd.sessionId), deps.clock.now())
