import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { AttemptCounter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { requireStaff } from '../domain/policies'
import { matchTotp, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUri } from '../domain/totp'
import { hashToken, invalid, type IdentityError } from './email-tokens'
import type { Actor, IdentityRepository, MfaState, SecretBox } from './ports'
import { startSession } from './sessions'

// TOTP and recovery codes: 5 failures / 15 min block the staff account's TOTP (08-securite.md § 8), per account.
// shortcut: fixed window, so the block lasts until the end of the current 15 min; sliding window if it matters
export const MFA_FAILURES: RateLimitRule = { name: 'mfa-failures', limit: 5, windowSeconds: 900 }

type Deps = {
  repo: IdentityRepository
  uow: UnitOfWork<IdentityRepository>
  box: SecretBox
  limiter: AttemptCounter
  clock: Clock
}
type Staff = Pick<Actor, 'id' | 'username' | 'role'>

/**
 * First step of the TOTP of a staff account without one (US-55.2): a new secret, stored sealed and waiting for
 * its first code. Asked again, it replaces the waiting one; refused once the TOTP is enabled.
 */
export const startMfaSetup =
  (deps: Deps) =>
  async (cmd: { actor: Staff }): Promise<Result<{ secret: string; uri: string }, IdentityError>> => {
    const allowed = requireStaff(cmd.actor)
    if (!allowed.ok) return allowed
    if ((await deps.repo.findMfa(cmd.actor.id))?.enabledAt) return err({ kind: 'forbidden', reason: 'mfa_enabled' })
    const secret = newTotpSecret()
    await deps.repo.setPendingMfa(cmd.actor.id, await deps.box.seal(secret))
    return ok({ secret, uri: otpauthUri(secret, cmd.actor.username) })
  }

type PassCommand = { actor: Staff; sessionId: string; code: string; userAgent?: string }

/**
 * First code of a waiting setup (US-55.2): enables the TOTP and gives the 10 recovery codes, shown this once. Then
 * the session passes the TOTP, as with the challenge.
 */
export const verifyMfa = (deps: Deps) => (cmd: PassCommand) => passMfa(deps, cmd, 'setup')

/** TOTP code or unused recovery code after a staff sign-in (US-55.2, US-55.5); each code passes once. */
export const challengeMfa = (deps: Deps) => (cmd: PassCommand) => passMfa(deps, cmd, 'challenge')

/** Uses the code: the first TOTP code enables the setup with new recovery codes, then a TOTP or a recovery code. */
async function useCode(
  deps: Deps,
  userId: string,
  mfa: MfaState & { secretEnc: string },
  code: string,
  now: Date,
): Promise<{ passed: boolean; recoveryCodes?: string[] }> {
  const step = await matchTotp(await deps.box.open(mfa.secretEnc), code.trim(), now, mfa.lastStep)
  if (mfa.enabledAt)
    return {
      passed:
        step !== null
          ? await deps.repo.useTotpStep(userId, step)
          : await deps.repo.useRecoveryCode(userId, await hashToken(normalizeRecoveryCode(code)), now),
    }
  if (step === null) return { passed: false }
  const recoveryCodes = newRecoveryCodes()
  const codeHashes = await Promise.all(recoveryCodes.map(hashToken))
  await deps.uow.run((repo) => repo.enableMfa(userId, { at: now, step, codeHashes }))
  return { passed: true, recoveryCodes }
}

/** A challenge needs an enabled TOTP, the first code a waiting setup. */
const mismatch = (mfa: MfaState | null, expected: 'setup' | 'challenge'): IdentityError | undefined =>
  expected === 'challenge' && !mfa?.enabledAt
    ? invalid('code', 'setup_required')
    : expected === 'setup' && mfa?.enabledAt
      ? { kind: 'forbidden', reason: 'mfa_enabled' }
      : undefined

/** The session gets a new id that has passed the TOTP, the previous one ends (privilege change, 08-securite.md § 3). */
async function passMfa(
  deps: Deps,
  cmd: PassCommand,
  expected: 'setup' | 'challenge',
): Promise<Result<{ sessionId: string; recoveryCodes?: string[] }, IdentityError>> {
  const allowed = requireStaff(cmd.actor)
  if (!allowed.ok) return allowed
  const userId = cmd.actor.id
  const limit = await deps.limiter.peek(MFA_FAILURES, userId)
  if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
  const mfa = await deps.repo.findMfa(userId)
  if (!mfa?.secretEnc || mismatch(mfa, expected))
    return err(mismatch(mfa, expected) ?? invalid('code', 'setup_required'))
  const now = deps.clock.now()
  const { passed, recoveryCodes } = await useCode(deps, userId, { ...mfa, secretEnc: mfa.secretEnc }, cmd.code, now)
  if (!passed) {
    await deps.limiter.consume(MFA_FAILURES, userId)
    return err(invalid('code', 'wrong'))
  }
  const sessionId = await startSession(deps.repo, now, {
    userId,
    userAgent: cmd.userAgent,
    previousSessionId: cmd.sessionId,
    mfaVerified: true,
  })
  return ok({ sessionId, ...(recoveryCodes ? { recoveryCodes } : {}) })
}
