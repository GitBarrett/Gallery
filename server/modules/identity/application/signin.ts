import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdentityError } from './email-tokens'
import type { IdentityRepository, PasswordHasher } from './ports'
import { isEnded, startSession } from './sessions'

export interface SigninCommand {
  email: string
  password: string
  userAgent?: string
  /** Session of the browser before signing in, revoked (new id at every sign-in). */
  previousSessionId?: string
}

const refused = err({ kind: 'invalid_credentials' } as const)
// Verified when there is no real hash; created once per isolate (the use case itself is built per request)
let dummyHash: Promise<string> | undefined

/**
 * Password sign-in (US-03.1–2), open to visitors. One answer for an unknown email, a wrong password, an account
 * without password (OAuth) or an ended one; a hash is verified in every case, so the time is the same too.
 * The progressive lockout (US-03.3) comes with T-12c.
 */
export const signin =
  (deps: { repo: IdentityRepository; hasher: PasswordHasher; clock: Clock }) =>
  async (cmd: SigninCommand): Promise<Result<{ sessionId: string }, IdentityError>> => {
    const account = await deps.repo.findCredentials(cmd.email)
    const stored = account?.passwordHash ?? (await (dummyHash ??= deps.hasher.hash('no account, same work')))
    const { valid } = await deps.hasher.verify(cmd.password, stored)
    if (!account?.passwordHash || !valid || isEnded(account.status)) return refused
    const sessionId = await startSession(deps.repo, deps.clock.now(), { ...cmd, userId: account.userId })
    return ok({ sessionId })
  }
