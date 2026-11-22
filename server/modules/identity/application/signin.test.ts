import { describe, expect, it, vi } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { hashToken } from './email-tokens'
import { signin } from './signin'

const clock = fixedClock('2026-11-22T12:00:00Z')

async function setup() {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash: 'hashed:correct horse battery',
    locale: 'en',
    termsAcceptedAt: clock.now(),
    termsVersion: 'v',
  })
  const hasher = {
    hash: vi.fn(async (p: string) => `hashed:${p}`),
    verify: vi.fn(async (p: string, stored: string) => ({ valid: stored === `hashed:${p}`, needsRehash: false })),
  }
  const { uow, sent } = inMemoryUnitOfWork(fake.repo)
  const human = {
    verify: async (token: string, _ip: string | undefined, action: string) => token === 'human' && action === 'signin',
  }
  const run = signin({ repo: fake.repo, uow, hasher, human, limiter: inMemoryRateLimiter(clock), clock })
  return { ...fake, hasher, sent, run }
}

const body = { email: 'ASH@example.com', password: 'correct horse battery', userAgent: 'Firefox' }
const refused = { ok: false, error: { kind: 'invalid_credentials' } }

describe('signin', () => {
  it('US-03.1 opens a session for valid credentials, the email in any case', async () => {
    const { run, sessions } = await setup()
    const result = await run(body)
    expect(result.ok && sessions[0]?.idHash).toBe(result.ok && (await hashToken(result.value.sessionId)))
    expect(sessions[0]).toMatchObject({ userId: 'ash', userAgentSummary: 'Firefox' })
  })

  it('US-03.1 revokes the session the browser had before', async () => {
    const { run, sessions } = await setup()
    const first = await run(body)
    await run({ ...body, previousSessionId: first.ok ? first.value.sessionId : '' })
    expect(sessions.map((s) => Boolean(s.revokedAt))).toEqual([true, false])
  })

  it('US-03.2 answers the same for a wrong password and an unknown email, after the same hashing work', async () => {
    const { run, sessions, hasher } = await setup()
    expect(await run({ ...body, password: 'wrong password' })).toEqual(refused)
    expect(await run({ ...body, email: 'nobody@example.com' })).toEqual(refused)
    expect(hasher.verify).toHaveBeenCalledTimes(2)
    expect(sessions).toEqual([])
  })

  it('refuses a banned or deleted account like wrong credentials, and an account without password', async () => {
    const { run, users } = await setup()
    for (const status of ['banned', 'pending_deletion']) {
      users[0]!.status = status
      expect(await run(body)).toEqual(refused)
    }
    users[0]!.status = 'active'
    users[0]!.passwordHash = null
    expect(await run(body)).toEqual(refused)
  })

  describe('progressive lockout', () => {
    const wrong = { ...body, password: 'wrong password', ip: '203.0.113.7' }
    const turnstileRequired = { ok: false, error: { kind: 'invalid', field: 'turnstileToken', reason: 'required' } }
    const fail = async (run: Awaited<ReturnType<typeof setup>>['run'], times: number, cmd: object = wrong) => {
      for (let i = 0; i < times; i++) await run({ ...wrong, turnstileToken: 'human', ...cmd })
    }

    it('US-03.3 asks for Turnstile after 5 failures on the account, then accepts a solved check', async () => {
      const { run } = await setup()
      await fail(run, 5, { ip: undefined, turnstileToken: undefined })
      expect(await run({ ...body, ip: '198.51.100.1' })).toEqual(turnstileRequired)
      expect(await run({ ...body, turnstileToken: 'bot' })).toMatchObject({ error: { reason: 'failed' } })
      expect(await run({ ...body, turnstileToken: 'human' })).toMatchObject({ ok: true })
    })

    it('US-03.3 asks for Turnstile after 5 failures from an IP, whatever the email, existing or not', async () => {
      const { run } = await setup()
      for (let i = 0; i < 5; i++) await run({ ...wrong, email: `nobody${i}@example.com` })
      expect(await run({ ...body, ip: wrong.ip })).toEqual(turnstileRequired)
      expect(await run({ ...body, email: 'nobody@example.com', ip: wrong.ip })).toEqual(turnstileRequired)
    })

    it('US-03.3 blocks the password sign-in for the hour after 20 failures, and alerts the owner once', async () => {
      const { run, sent } = await setup()
      await fail(run, 20)
      expect(sent()).toEqual([{ topic: 'emails', payload: { template: 'signin_locked', userId: 'ash' } }])
      const locked = await run({ ...body, turnstileToken: 'human', ip: '198.51.100.1' })
      expect(locked).toEqual({ ok: false, error: { kind: 'rate_limited', retryAfterSeconds: 3600 } })
      await fail(run, 3)
      expect(sent()).toHaveLength(1)
    })

    it('blocks an unknown email the same way, without any email', async () => {
      const { run, sent } = await setup()
      await fail(run, 20, { email: 'nobody@example.com' })
      expect(await run({ ...wrong, email: 'nobody@example.com', turnstileToken: 'human' })).toMatchObject({
        error: { kind: 'rate_limited' },
      })
      expect(sent()).toEqual([])
    })
  })
})
