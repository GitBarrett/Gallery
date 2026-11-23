import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { changePassword } from './change-password'
import { hashToken } from './email-tokens'
import { startSession } from './sessions'

const clock = fixedClock('2026-11-23T12:00:00Z')

async function setup(passwordHash: string | null = 'hashed:correct horse battery') {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash,
    locale: 'en',
    termsAcceptedAt: clock.now(),
    termsVersion: 'v',
  })
  const { uow } = inMemoryUnitOfWork(fake.repo)
  const change = changePassword({
    repo: fake.repo,
    uow,
    hasher: {
      hash: async (p) => `hashed:${p}`,
      verify: async (p, stored) => ({ valid: stored === `hashed:${p}`, needsRehash: false }),
    },
    breaches: { isBreached: async (p) => p === 'password1234' },
    limiter: inMemoryRateLimiter(clock),
    clock,
  })
  const laptop = await startSession(fake.repo, clock.now(), { userId: 'ash' })
  const current = await startSession(fake.repo, clock.now(), { userId: 'ash' })
  const cmd = {
    userId: 'ash',
    sessionId: current,
    currentPassword: 'correct horse battery',
    password: 'a new passphrase',
  }
  const active = () => fake.sessions.filter((s) => !s.revokedAt).map((s) => s.idHash)
  return { fake, change, cmd, laptop, current, active }
}

const invalid = (field: string, reason: string) => ({ ok: false, error: { kind: 'invalid', field, reason } })

describe('changePassword', () => {
  it('US-07.3 sets the new password checked with the old one, and revokes every other session', async () => {
    const { fake, change, cmd, current, active } = await setup()
    expect(await change(cmd)).toEqual({ ok: true, value: undefined })
    expect(fake.users[0]!.passwordHash).toBe('hashed:a new passphrase')
    expect(active()).toEqual([await hashToken(current)])
  })

  it('US-07.3 refuses a wrong old password and keeps every session', async () => {
    const { fake, change, cmd, active } = await setup()
    expect(await change({ ...cmd, currentPassword: 'wrong guess here' })).toEqual(invalid('currentPassword', 'wrong'))
    expect(fake.users[0]!.passwordHash).toBe('hashed:correct horse battery')
    expect(active()).toHaveLength(2)
  })

  it('US-07.3 applies the sign-up rules and the breach check to the new password', async () => {
    const { change, cmd } = await setup()
    expect(await change({ ...cmd, password: 'short' })).toEqual(invalid('password', 'too_short'))
    expect(await change({ ...cmd, password: 'password1234' })).toEqual(invalid('password', 'breached'))
  })

  it('US-07.3 refuses an account without a password (OAuth): it sets one with a reset link', async () => {
    const { change, cmd } = await setup(null)
    expect(await change(cmd)).toEqual(invalid('currentPassword', 'none'))
  })

  it('US-07.3 stops guessing the old password after 5 failures in 15 min', async () => {
    const { change, cmd } = await setup()
    for (let i = 0; i < 5; i++) await change({ ...cmd, currentPassword: `wrong guess ${i}` })
    expect(await change(cmd)).toMatchObject({ ok: false, error: { kind: 'rate_limited' } })
  })
})
