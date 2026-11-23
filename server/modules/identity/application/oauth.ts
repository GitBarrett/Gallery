import { validateUsername } from '../../../../shared/domain/account-rules'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import type { Logger } from '../../../platform/logger'
import type { RateLimiter } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { base64url, hashToken, invalid, newToken, type IdentityError } from './email-tokens'
import type { IdentityRepository, Locale, OAuthProvider, OAuthProviderName } from './ports'
import { isEnded, startSession } from './sessions'
import { SIGNUP_PER_IP, TERMS_VERSION } from './signup'

/**
 * Identity back from the provider with no linked account: it waits, in a sealed cookie, for the username step
 * (US-02.1) or, when its email is an account's, for the sign-in to that account that links it (US-02.3).
 */
export interface PendingOAuth {
  provider: OAuthProviderName
  subject: string
  email: string | null
  emailTaken: boolean
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

/** First leg (08-securite.md § 3): single-use random state and PKCE verifier, kept by the caller until the callback. */
export async function startOAuth(provider: OAuthProvider, redirectUri: string) {
  const state = newToken()
  const verifier = newToken()
  return {
    url: provider.authorizationUrl({ state, codeChallenge: await pkceChallenge(verifier), redirectUri }),
    state,
    verifier,
  }
}

export interface OAuthCallbackCommand {
  provider: OAuthProviderName
  state?: string
  code?: string
  /** State and verifier kept at the start; absent once used (replay) or expired. */
  expected?: { state: string; verifier: string }
  userAgent?: string
  previousSessionId?: string
}

type CallbackOutcome = { kind: 'signed_in'; sessionId: string } | { kind: 'pending'; pending: PendingOAuth }

/**
 * Return from the provider (US-02.1–5), open to visitors. The state is checked before anything else; a linked
 * identity signs in, any other one waits: no account is created nor merged here.
 */
export const oauthCallback =
  (deps: { repo: IdentityRepository; provider: OAuthProvider; clock: Clock; logger: Logger; redirectUri: string }) =>
  async (cmd: OAuthCallbackCommand): Promise<Result<CallbackOutcome, IdentityError>> => {
    if (!cmd.state || !cmd.expected || cmd.state !== cmd.expected.state) return err(invalid('state', 'invalid'))
    if (!cmd.code) return err({ kind: 'oauth_failed' }) // refused on the consent screen
    const { code, provider } = cmd
    const identity = await deps.provider
      .identity({ code, codeVerifier: cmd.expected.verifier, redirectUri: deps.redirectUri })
      .catch((error: unknown) =>
        deps.logger.warn('oauth exchange failed', { provider, error: String((error as Error)?.message ?? error) }),
      )
    if (!identity) return err({ kind: 'oauth_failed' })
    const account = await deps.repo.findOAuthAccount(provider, identity.subject)
    if (account && isEnded(account.status)) return err({ kind: 'oauth_failed' })
    if (account) {
      const sessionId = await startSession(deps.repo, deps.clock.now(), { ...cmd, userId: account.userId })
      return ok({ kind: 'signed_in', sessionId })
    }
    const emailTaken = identity.email !== null && (await deps.repo.findUserIdByEmail(identity.email)) !== null
    return ok({ kind: 'pending', pending: { provider, subject: identity.subject, email: identity.email, emailTaken } })
  }

export interface CompleteOAuthCommand {
  pending: PendingOAuth
  username: string
  locale: Locale
  ip: string | undefined
  /** Invitation kept from the start of the flow, required while `features.inviteOnly` is on (US-56.4). */
  inviteToken?: string
  userAgent?: string
  previousSessionId?: string
}

const inviteRequired = err({ kind: 'invite_required' } as const)
// Thrown inside the transaction to cancel the account
class InviteUsed extends Error {}
class LinkedConcurrently extends Error {}

/** Why the account cannot be created, checked inside the transaction; otherwise the invitation to use. */
async function refusalOf(
  repo: IdentityRepository,
  pending: PendingOAuth,
  username: string,
  inviteHash: string | null,
  now: Date,
): Promise<IdentityError | { inviteId: string | null }> {
  if (await repo.findOAuthAccount(pending.provider, pending.subject)) return { kind: 'taken', field: 'provider' }
  if (await repo.usernameTaken(username)) return { kind: 'taken', field: 'username' }
  const inviteId = inviteHash === null ? null : await repo.findUsableInvite(inviteHash, now)
  if (inviteHash !== null && !inviteId) return { kind: 'invite_required' }
  if (pending.email && (await repo.findUserIdByEmail(pending.email))) return { kind: 'taken', field: 'email' }
  return { inviteId }
}

/**
 * Username and Terms step of a first OAuth sign-in (US-02.1): creates the account, its email verified by the
 * provider, links the identity and opens the session. Never for the email of an existing account (US-02.3).
 * Same per-IP limit and invitation rule as the sign-up; no Turnstile, the provider sign-in stands for it (Q53).
 */
export const completeOAuthSignup =
  (deps: {
    uow: UnitOfWork<IdentityRepository>
    limiter: RateLimiter
    ids: IdGenerator
    clock: Clock
    inviteOnly: () => Promise<boolean>
  }) =>
  async (cmd: CompleteOAuthCommand): Promise<Result<{ sessionId: string }, IdentityError>> => {
    const limit = await deps.limiter.consume(SIGNUP_PER_IP, cmd.ip ?? 'unknown')
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const inviteHash = (await deps.inviteOnly()) ? await hashToken(cmd.inviteToken ?? '') : null
    const username = validateUsername(cmd.username)
    if (!username.ok) return err(invalid('username', username.error))
    const { pending } = cmd

    const run = deps.uow.run(async (repo): Promise<Result<{ sessionId: string }, IdentityError>> => {
      const now = deps.clock.now()
      const checked = await refusalOf(repo, pending, username.value, inviteHash, now)
      if ('kind' in checked) return err(checked)
      const id = deps.ids.next()
      const created = await repo.createUser({
        id,
        email: pending.email,
        ...(pending.email ? { emailVerifiedAt: now } : {}),
        username: username.value,
        passwordHash: null,
        locale: cmd.locale,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
      })
      if (created !== 'created') return err({ kind: 'taken', field: created === 'email_taken' ? 'email' : 'username' })
      const link = { id: deps.ids.next(), userId: id, provider: pending.provider, subject: pending.subject }
      if (!(await repo.linkOAuthAccount(link))) throw new LinkedConcurrently() // cancels the account
      if (checked.inviteId && !(await repo.useInvite(checked.inviteId, now))) throw new InviteUsed()
      return ok({ sessionId: await startSession(repo, now, { ...cmd, userId: id }) })
    })
    return run.catch((error: unknown) => {
      if (error instanceof LinkedConcurrently) return err({ kind: 'taken', field: 'provider' } as const)
      if (error instanceof InviteUsed) return inviteRequired
      throw error
    })
  }
