import type { Clock } from '../../../platform/clock'
import { err, ok } from '../../../../shared/domain/result'
import { deviceOf, type Device } from '../domain/device'
import { hashToken, newToken, type IdentityResult } from './email-tokens'
import type { Actor, IdentityRepository } from './ports'

/** 30 days, sliding (US-03.1). */
export const SESSION_TTL_MS = 30 * 86_400_000
/** A staff session ends 12 h after its start, sliding or not (08-securite.md § 3). */
export const STAFF_SESSION_MS = 12 * 3_600_000
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
  opts: { userId: string; userAgent?: string; previousSessionId?: string; mfaVerified?: boolean },
): Promise<string> {
  if (opts.previousSessionId) await repo.revokeSession(await hashToken(opts.previousSessionId), now)
  const id = newToken()
  await repo.createSession({
    idHash: await hashToken(id),
    userId: opts.userId,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    userAgentSummary: opts.userAgent?.slice(0, 200) ?? null,
    ...(opts.mfaVerified ? { mfaVerifiedAt: now } : {}),
  })
  return id
}

/**
 * Member of a session id, checked at each request (ADR-010): null when unknown, revoked or expired. The session
 * of a banned or deleted account is revoked (US-03.5), a staff one at 12 h. `refreshed`: the 30 days restarted, reseal the cookie.
 */
export const resolveSession =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { sessionId: string }): Promise<{ actor: Actor; refreshed: boolean } | null> => {
    const idHash = await hashToken(cmd.sessionId)
    const session = await deps.repo.findSession(idHash)
    const now = deps.clock.now()
    if (!session || session.revokedAt || session.expiresAt <= now) return null
    const staffEnded = session.account.role !== 'user' && +now - +session.createdAt >= STAFF_SESSION_MS
    if (isEnded(session.account.status) || staffEnded) {
      await deps.repo.revokeSession(idHash, now)
      return null
    }
    const refreshed = now.getTime() - session.lastSeenAt.getTime() >= TOUCH_MS
    if (refreshed) await deps.repo.touchSession(idHash, now, new Date(now.getTime() + SESSION_TTL_MS))
    return { actor: { ...session.account, mfaVerified: Boolean(session.mfaVerifiedAt) }, refreshed }
  }

/**
 * Active sessions of the member (US-03.7), the one of this request marked. Their `id` is the stored hash: it
 * cannot be used as a cookie (Q51). Last activity is exact to the hour (TOUCH_MS).
 */
export interface DeviceSession {
  id: string
  device: Device
  createdAt: Date
  lastSeenAt: Date
  current: boolean
}

export const listSessions =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { userId: string; sessionId: string }): Promise<DeviceSession[]> => {
    const current = await hashToken(cmd.sessionId)
    const rows = await deps.repo.listSessions(cmd.userId, deps.clock.now())
    return rows.map((s) => ({
      id: s.idHash,
      device: deviceOf(s.userAgentSummary),
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.idHash === current,
    }))
  }

/** Revokes one of the member's sessions (US-03.8); another member's is not found (404, never 403). */
export const revokeSession =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { userId: string; id: string }): Promise<IdentityResult> =>
    (await deps.repo.revokeUserSession(cmd.userId, cmd.id, deps.clock.now()))
      ? ok(undefined)
      : err({ kind: 'not_found' })

/** Revokes every session of the member but the one of this request (US-03.9). */
export const revokeOtherSessions =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { userId: string; sessionId: string }): Promise<void> =>
    deps.repo.revokeOtherSessions(cmd.userId, await hashToken(cmd.sessionId), deps.clock.now())

/** Sign-out (US-03.4): the session is revoked server side, a copy of the cookie is useless. */
export const signout =
  (deps: { repo: IdentityRepository; clock: Clock }) =>
  async (cmd: { sessionId: string }): Promise<void> =>
    deps.repo.revokeSession(await hashToken(cmd.sessionId), deps.clock.now())
