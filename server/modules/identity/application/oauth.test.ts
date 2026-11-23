import { describe, expect, it, vi } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { hashToken } from './email-tokens'
import { completeOAuthSignup, oauthCallback, pkceChallenge, startOAuth, type PendingOAuth } from './oauth'
import type { OAuthIdentity, OAuthProvider } from './ports'
import { TERMS_VERSION } from './signup'

const clock = fixedClock('2026-11-22T12:00:00Z')
const redirectUri = 'https://legendaryshots.gg/auth/google/callback'
const expected = { state: 'state-1', verifier: 'verifier-1' }
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function setup({ identity = { subject: 'g-1', email: 'ash@example.com' } as OAuthIdentity | Error } = {}) {
  const fake = inMemoryIdentityRepository()
  const provider: OAuthProvider = {
    authorizationUrl: ({ state, codeChallenge }) => `https://provider.test/auth?state=${state}&c=${codeChallenge}`,
    identity: vi.fn(async () => {
      if (identity instanceof Error) throw identity
      return identity
    }),
  }
  const callback = oauthCallback({ repo: fake.repo, provider, clock, logger, redirectUri })
  let n = 0
  const complete = (inviteOnly = false) =>
    completeOAuthSignup({
      uow: inMemoryUnitOfWork(fake.repo).uow,
      limiter: inMemoryRateLimiter(clock),
      ids: { next: () => `id-${++n}` },
      clock,
      inviteOnly: async () => inviteOnly,
    })
  return { ...fake, provider, callback, complete }
}

const back = { provider: 'google' as const, state: 'state-1', code: 'code-1', expected, userAgent: 'Firefox' }
const pending: PendingOAuth = { provider: 'google', subject: 'g-1', email: 'ash@example.com', emailTaken: false }
const signupCmd = { pending, username: 'Ash_Barrett', locale: 'fr' as const, ip: '203.0.113.7' }

async function passwordAccount(repo: ReturnType<typeof inMemoryIdentityRepository>['repo']) {
  await repo.createUser({
    id: 'ash',
    email: 'Ash@Example.com',
    username: 'Ash',
    passwordHash: 'hashed',
    locale: 'en',
    termsAcceptedAt: clock.now(),
    termsVersion: 'v',
  })
}

describe('startOAuth', () => {
  it('US-02.4 sends to the provider with a fresh random state and the S256 challenge of a fresh verifier', async () => {
    const { provider } = setup()
    const first = await startOAuth(provider, redirectUri)
    const second = await startOAuth(provider, redirectUri)
    expect(first.state).toMatch(/^[\w-]{43}$/)
    expect(first.state).not.toBe(second.state)
    expect(first.verifier).not.toBe(second.verifier)
    expect(first.url).toBe(`https://provider.test/auth?state=${first.state}&c=${await pkceChallenge(first.verifier)}`)
  })

  it('computes the PKCE challenge of RFC 7636 appendix B', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

describe('oauthCallback', () => {
  it('US-02.1 keeps a first identity pending, with no account, until the username step', async () => {
    const { callback, users, provider } = setup()
    expect(await callback(back)).toEqual({ ok: true, value: { kind: 'pending', pending } })
    expect(users).toEqual([])
    expect(provider.identity).toHaveBeenCalledWith({ code: 'code-1', codeVerifier: 'verifier-1', redirectUri })
  })

  it('US-02.2 signs a linked identity in at once, revoking the session the browser had', async () => {
    const { callback, repo, sessions } = setup()
    await passwordAccount(repo)
    await repo.linkOAuthAccount({ id: 'l', userId: 'ash', provider: 'google', subject: 'g-1' })
    await repo.createSession({
      idHash: await hashToken('old'),
      userId: 'ash',
      lastSeenAt: clock.now(),
      expiresAt: clock.now(),
      userAgentSummary: null,
    })
    const result = await callback({ ...back, previousSessionId: 'old' })
    expect(result.ok && result.value.kind).toBe('signed_in')
    const sessionId = result.ok && result.value.kind === 'signed_in' ? result.value.sessionId : ''
    expect(sessions.map((s) => [s.idHash, Boolean(s.revokedAt)])).toEqual([
      [await hashToken('old'), true],
      [await hashToken(sessionId), false],
    ])
    expect(sessions[1]).toMatchObject({ userId: 'ash', userAgentSummary: 'Firefox' })
  })

  it('US-02.2 refuses a linked identity whose account is banned or being deleted', async () => {
    const { callback, repo, users, sessions } = setup()
    await passwordAccount(repo)
    await repo.linkOAuthAccount({ id: 'l', userId: 'ash', provider: 'google', subject: 'g-1' })
    users[0]!.status = 'banned'
    expect(await callback(back)).toEqual({ ok: false, error: { kind: 'oauth_failed' } })
    expect(sessions).toEqual([])
  })

  it('US-02.3 never merges: the email of an existing account is pending, marked taken', async () => {
    const { callback, repo, oauth } = setup({ identity: { subject: 'g-1', email: 'ash@example.com' } })
    await passwordAccount(repo)
    expect(await callback(back)).toEqual({
      ok: true,
      value: { kind: 'pending', pending: { ...pending, emailTaken: true } },
    })
    expect(oauth).toEqual([])
  })

  it('US-02.4 refuses a missing, replayed or different state before calling the provider, with no session', async () => {
    const { callback, provider, sessions } = setup()
    const refused = { ok: false, error: { kind: 'invalid', field: 'state', reason: 'invalid' } }
    expect(await callback({ ...back, state: undefined })).toEqual(refused)
    expect(await callback({ ...back, expected: undefined })).toEqual(refused) // replayed: the cookie is gone
    expect(await callback({ ...back, state: 'state-2' })).toEqual(refused)
    expect(provider.identity).not.toHaveBeenCalled()
    expect(sessions).toEqual([])
  })

  it('US-02.5 reports a refusal or an error of the provider', async () => {
    const denied = setup()
    expect(await denied.callback({ ...back, code: undefined })).toEqual({ ok: false, error: { kind: 'oauth_failed' } })
    const failing = setup({ identity: new Error('invalid_grant') })
    expect(await failing.callback(back)).toEqual({ ok: false, error: { kind: 'oauth_failed' } })
    expect(logger.warn).toHaveBeenCalledWith('oauth exchange failed', { provider: 'google', error: 'invalid_grant' })
  })
})

describe('completeOAuthSignup', () => {
  it('US-02.1 creates the account with the verified email, the Terms and the link, then opens a session', async () => {
    const { complete, users, oauth, sessions } = setup()
    const result = await complete()(signupCmd)
    expect(users).toEqual([
      {
        id: 'id-1',
        email: 'ash@example.com',
        emailVerifiedAt: clock.now(),
        username: 'Ash_Barrett',
        passwordHash: null,
        locale: 'fr',
        termsAcceptedAt: clock.now(),
        termsVersion: TERMS_VERSION,
        role: 'user',
        status: 'active',
      },
    ])
    expect(oauth).toEqual([{ id: 'id-2', userId: 'id-1', provider: 'google', subject: 'g-1' }])
    expect(result.ok && sessions[0]?.idHash).toBe(result.ok && (await hashToken(result.value.sessionId)))
  })

  it('US-02.1 creates an account without email when the provider gave no verified one', async () => {
    const { complete, users } = setup()
    expect((await complete()({ ...signupCmd, pending: { ...pending, email: null } })).ok).toBe(true)
    expect(users[0]).toMatchObject({ email: null, emailVerifiedAt: null })
  })

  it('US-02.1 checks the username like the sign-up', async () => {
    const { complete, repo } = setup()
    expect(await complete()({ ...signupCmd, username: 'a' })).toMatchObject({ ok: false, error: { field: 'username' } })
    await passwordAccount(repo)
    expect(await complete()({ ...signupCmd, username: 'ASH' })).toEqual({
      ok: false,
      error: { kind: 'taken', field: 'username' },
    })
  })

  it('US-02.3 refuses a new account for the email of an existing one', async () => {
    const { complete, repo, users, oauth } = setup()
    await passwordAccount(repo)
    expect(await complete()(signupCmd)).toEqual({ ok: false, error: { kind: 'taken', field: 'email' } })
    expect(users).toHaveLength(1)
    expect(oauth).toEqual([])
  })

  it('creates one account only when the step is sent twice', async () => {
    const { complete, users } = setup()
    await complete()(signupCmd)
    expect(await complete()({ ...signupCmd, username: 'Other' })).toEqual({
      ok: false,
      error: { kind: 'taken', field: 'provider' },
    })
    expect(users).toHaveLength(1)
  })

  it('US-56.4 requires an invitation during the beta, used by the account', async () => {
    const { complete, repo, invites } = setup()
    expect(await complete(true)(signupCmd)).toEqual({ ok: false, error: { kind: 'invite_required' } })
    await repo.createInvite({
      id: 'inv',
      emailHmac: 'h',
      tokenHash: await hashToken('tok'),
      invitedBy: null,
      expiresAt: new Date('2026-12-01'),
    })
    expect((await complete(true)({ ...signupCmd, inviteToken: 'tok' })).ok).toBe(true)
    expect(invites[0]?.usedAt).toEqual(clock.now())
  })
})
