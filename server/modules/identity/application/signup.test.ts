import { describe, expect, it, vi } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { signup, TERMS_VERSION } from './signup'

const clock = fixedClock('2026-11-22T12:00:00Z')

function setup() {
  const { repo, users } = inMemoryIdentityRepository()
  const { uow, sent } = inMemoryUnitOfWork(repo)
  const hasher = { hash: vi.fn(async (p: string) => `hashed:${p}`), verify: vi.fn() }
  let n = 0
  const run = signup({
    uow,
    hasher,
    human: { verify: async (token) => token === 'human' },
    breaches: { isBreached: async (p) => p === 'password123' },
    limiter: inMemoryRateLimiter(clock),
    ids: { next: () => `user-${++n}` },
    clock,
  })
  return { run, users, sent, hasher }
}

const body = {
  email: 'ash@example.com',
  username: 'Ash_Barrett',
  password: 'correct horse battery',
  termsAccepted: true as const,
  turnstileToken: 'human',
  locale: 'fr' as const,
  ip: '203.0.113.7',
}

describe('signup', () => {
  it('US-01.1 creates an unverified account with the accepted Terms and sends the verification email', async () => {
    const { run, users, sent } = setup()
    expect(await run(body)).toEqual({ ok: true, value: undefined })
    expect(users).toEqual([
      {
        id: 'user-1',
        email: 'ash@example.com',
        username: 'Ash_Barrett',
        passwordHash: 'hashed:correct horse battery',
        locale: 'fr',
        termsAcceptedAt: clock.now(),
        termsVersion: TERMS_VERSION,
        emailVerifiedAt: null,
      },
    ])
    expect(sent()).toEqual([{ topic: 'emails', payload: { template: 'verify', userId: 'user-1' } }])
  })

  it('US-01.2 answers the same for a used email and tells its owner an account exists', async () => {
    const { run, users, sent, hasher } = setup()
    await run(body)
    const again = await run({ ...body, email: 'ASH@example.com', username: 'Other', ip: '198.51.100.1' })
    expect(again).toEqual({ ok: true, value: undefined })
    expect(users).toHaveLength(1)
    expect(sent()[1]).toEqual({ topic: 'emails', payload: { template: 'account_exists', userId: 'user-1' } })
    expect(hasher.hash).toHaveBeenCalledTimes(2) // same work, hence same response time
  })

  it('US-01.3 refuses a password found in a known breach, with an explicit reason', async () => {
    const { run, users } = setup()
    expect(await run({ ...body, password: 'password123' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'password', reason: 'breached' },
    })
    expect(users).toEqual([])
  })

  it('US-01.6 refuses a sign-up whose Turnstile check fails', async () => {
    const { run, users } = setup()
    expect(await run({ ...body, turnstileToken: 'bot' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'turnstileToken', reason: 'failed' },
    })
    expect(users).toEqual([])
  })

  it('allows 3 sign-ups per hour and per IP', async () => {
    const { run } = setup()
    for (const name of ['Ash1', 'Ash2', 'Ash3']) await run({ ...body, email: `${name}@example.com`, username: name })
    expect(await run({ ...body, email: 'ash4@example.com', username: 'Ash4' })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: 3600 },
    })
  })

  it('refuses an invalid username or password with the rule broken', async () => {
    const { run } = setup()
    expect(await run({ ...body, username: 'admin' })).toMatchObject({
      error: { field: 'username', reason: 'reserved' },
    })
    expect(await run({ ...body, password: 'short' })).toMatchObject({
      error: { field: 'password', reason: 'too_short' },
    })
  })

  it('reports a username already taken, in any case, even when the email is used too', async () => {
    const { run } = setup()
    await run(body)
    expect(await run({ ...body, email: 'other@example.com', username: 'ASH_barrett' })).toEqual({
      ok: false,
      error: { kind: 'taken', field: 'username' },
    })
    expect(await run({ ...body, username: 'ash_barrett' })).toMatchObject({ error: { kind: 'taken' } })
  })
})
