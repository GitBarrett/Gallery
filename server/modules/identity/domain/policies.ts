import { err, ok, type Result } from '../../../../shared/domain/result'

export type PolicyDenial = { kind: 'forbidden'; reason: 'email_unverified' }

/**
 * Publishing, commenting and taking part in a contest need a verified email (US-08.1); liking and following do
 * not (US-08.2). Declared by the use cases of those features (T-21, T-41, contests); the reason drives the
 * "Verify your email" banner with its resend button.
 */
export const requireVerified = (actor: { emailVerified: boolean }): Result<void, PolicyDenial> =>
  actor.emailVerified ? ok(undefined) : err({ kind: 'forbidden', reason: 'email_unverified' })
