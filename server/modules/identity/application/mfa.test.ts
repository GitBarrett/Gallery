import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { totpAt } from '../domain/totp'
import { hashToken } from './email-tokens'
import { challengeMfa, startMfaSetup, verifyMfa } from './mfa'
import { resolveSession, startSession } from './sessions'

const clock = fixedClock('2026-11-24T12:00:00Z')
const step = Math.floor(clock.now().getTime() / 30_000)

async function setup(role: 'user' | 'moderator' | 'admin' = 'moderator') {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash: 'h',
    locale: 'en',
    termsAcceptedAt: clock.now(),
    termsVersion: 'v',
  })
  fake.users[0]!.role = role
  const { uow } = inMemoryUnitOfWork(fake.repo)
  const deps = {
    repo: fake.repo,
    uow,
    box: { seal: async (s: string) => `sealed:${s}`, open: async (s: string) => s.slice(7) },
    limiter: inMemoryRateLimiter(clock),
    clock,
  }
  const actor = { id: 'ash', username: 'Ash_Barrett', role }
  const sessionId = await startSession(fake.repo, clock.now(), { userId: 'ash' })
  const resolve = (id: string) => resolveSession({ repo: fake.repo, clock })({ sessionId: id })
  return {
    fake,
    deps,
    actor,
    sessionId,
    resolve,
    setUp: startMfaSetup(deps),
    verify: verifyMfa(deps),
    challenge: challengeMfa(deps),
  }
}

/** Staff whose TOTP is enabled, with its secret and recovery codes. */
async function enrolled() {
  const s = await setup()
  const started = await s.setUp({ actor: s.actor })
  if (!started.ok) throw new Error('setup refused')
  const code = await totpAt(started.value.secret, step - 1)
  const done = await s.verify({ actor: s.actor, sessionId: s.sessionId, code })
  if (!done.ok) throw new Error('verify refused')
  const sessionId = await startSession(s.fake.repo, clock.now(), { userId: 'ash' })
  return { ...s, secret: started.value.secret, codes: done.value.recoveryCodes!, sessionId }
}

const wrong = { ok: false, error: { kind: 'invalid', field: 'code', reason: 'wrong' } }

describe('staff TOTP', () => {
  it('US-55.2 refuses the setup and the challenge to a member', async () => {
    const { setUp, verify, challenge, actor, sessionId } = await setup('user')
    const refused = { ok: false, error: { kind: 'forbidden', reason: 'role' } }
    expect(await setUp({ actor })).toEqual(refused)
    expect(await verify({ actor, sessionId, code: '123456' })).toEqual(refused)
    expect(await challenge({ actor, sessionId, code: '123456' })).toEqual(refused)
  })

  it('US-55.2 leads a staff without TOTP to enable it: secret stored sealed, 10 codes shown once', async () => {
    const { setUp, verify, actor, sessionId, fake, resolve } = await setup()
    const started = await setUp({ actor })
    if (!started.ok) throw new Error('refused')
    expect(started.value.uri).toContain(`secret=${started.value.secret}`)
    expect((await fake.repo.findMfa('ash'))?.secretEnc).toBe(`sealed:${started.value.secret}`)
    const done = await verify({ actor, sessionId, code: await totpAt(started.value.secret, step) })
    if (!done.ok) throw new Error('refused')
    expect(done.value.recoveryCodes).toHaveLength(10)
    expect(await fake.repo.findMfa('ash')).toMatchObject({ enabledAt: clock.now(), lastStep: step })
    // a new session id at this privilege change, which has passed the TOTP; the previous one ends
    expect(await resolve(sessionId)).toBeNull()
    expect(await resolve(done.value.sessionId)).toMatchObject({ actor: { mfaVerified: true } })
    expect(await setUp({ actor })).toEqual({ ok: false, error: { kind: 'forbidden', reason: 'mfa_enabled' } })
  })

  it('US-55.2 refuses a wrong first code and a challenge before any setup', async () => {
    const { setUp, verify, challenge, actor, sessionId } = await setup()
    const setupRequired = { ok: false, error: { kind: 'invalid', field: 'code', reason: 'setup_required' } }
    expect(await verify({ actor, sessionId, code: '123456' })).toEqual(setupRequired)
    const started = await setUp({ actor })
    if (!started.ok) throw new Error('refused')
    const bad = String((Number(await totpAt(started.value.secret, step)) + 1) % 1_000_000).padStart(6, '0')
    expect(await verify({ actor, sessionId, code: bad })).toEqual(wrong)
    // a recovery code cannot confirm the setup, nor a challenge skip it
    expect(await verify({ actor, sessionId, code: 'abcde-fghij' })).toEqual(wrong)
    expect(await challenge({ actor, sessionId, code: await totpAt(started.value.secret, step) })).toEqual(setupRequired)
  })

  it('US-55.2 asks the TOTP again at each sign-in and refuses a code already used', async () => {
    const { verify, challenge, actor, sessionId, secret, resolve } = await enrolled()
    const code = await totpAt(secret, step)
    expect(await verify({ actor, sessionId, code })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'mfa_enabled' },
    })
    const done = await challenge({ actor, sessionId, code })
    if (!done.ok) throw new Error('refused')
    expect(done.value.recoveryCodes).toBeUndefined()
    expect(await resolve(done.value.sessionId)).toMatchObject({ actor: { mfaVerified: true } })
    expect(await challenge({ actor, sessionId: done.value.sessionId, code })).toEqual(wrong)
  })

  it('US-55.5 accepts each recovery code once, whatever its case and dashes', async () => {
    const { challenge, actor, sessionId, codes, fake } = await enrolled()
    const typed = codes[3]!.toUpperCase().replace('-', ' ')
    expect(await challenge({ actor, sessionId, code: typed })).toMatchObject({ ok: true })
    const next = await startSession(fake.repo, clock.now(), { userId: 'ash' })
    expect(await challenge({ actor, sessionId: next, code: codes[3]! })).toEqual(wrong)
    expect(await fake.repo.useRecoveryCode('ash', await hashToken(codes[4]!), clock.now())).toBe(true)
  })

  it('US-55.2 blocks the TOTP of the account for 15 min after 5 failures', async () => {
    const { challenge, actor, sessionId, secret } = await enrolled()
    for (let i = 0; i < 5; i++) expect(await challenge({ actor, sessionId, code: '000000' })).toEqual(wrong)
    expect(await challenge({ actor, sessionId, code: await totpAt(secret, step) })).toMatchObject({
      ok: false,
      error: { kind: 'rate_limited' },
    })
  })
})
