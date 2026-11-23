import { err, ok, type Result } from '../../../../shared/domain/result'

// Policies declared by the use cases (08-securite.md § 4, 10-clean-architecture.md § 4): each one refuses unless its
// condition holds. A session itself is required by the route (`requireContext`, 401); the routes and the policy they
// call are listed in tests/authorization-matrix.ts, checked by the architecture and the matrix tests.

export type PolicyDenial =
  { kind: 'forbidden'; reason: 'email_unverified' | 'suspended' | 'role' } | { kind: 'not_found' }

/**
 * Publishing, commenting and taking part in a contest need a verified email (US-08.1); liking and following do
 * not (US-08.2). Declared by the use cases of those features (T-21, T-41, contests); the reason drives the
 * "Verify your email" banner with its resend button.
 */
export const requireVerified = (actor: { emailVerified: boolean }): Result<void, PolicyDenial> =>
  actor.emailVerified ? ok(undefined) : err({ kind: 'forbidden', reason: 'email_unverified' })

/** A sanctioned member keeps reading and their own account, but may not post (annexe B, column "suspendu"). */
export const notSanctioned = (actor: { status: string }): Result<void, PolicyDenial> =>
  actor.status === 'active' ? ok(undefined) : err({ kind: 'forbidden', reason: 'suspended' })

const RANK = { user: 0, moderator: 1, admin: 2 } as const

/** Moderation needs a moderator or an admin, administration an admin (US-55; the TOTP check comes with T-18b). */
export const requireRole = (
  actor: { role: keyof typeof RANK },
  role: 'moderator' | 'admin',
): Result<void, PolicyDenial> =>
  RANK[actor.role] >= RANK[role] ? ok(undefined) : err({ kind: 'forbidden', reason: 'role' })

/** Another member's private resource is not found, so its existence is not revealed (08-securite.md § 4). */
export const requireOwner = (actor: { id: string }, ownerId: string): Result<void, PolicyDenial> =>
  actor.id === ownerId ? ok(undefined) : err({ kind: 'not_found' })
