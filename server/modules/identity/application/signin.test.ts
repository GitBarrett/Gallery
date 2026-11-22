import { describe, expect, it, vi } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
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
  return { ...fake, hasher, run: signin({ repo: fake.repo, hasher, clock }) }
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
})
