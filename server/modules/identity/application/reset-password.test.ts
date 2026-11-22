import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { hashToken } from './email-tokens'
import { resetPassword } from './reset-password'
import { startSession } from './sessions'

const now = '2026-11-22T12:00:00Z'

async function setup({ expiresAt = '2026-11-22T12:30:00Z', type = 'reset' as const } = {}) {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'ash',
    passwordHash: 'old',
    locale: 'en',
    termsAcceptedAt: new Date(now),
    termsVersion: 'v',
  })
  await fake.repo.createEmailToken({
    id: 'token-ash',
    userId: 'ash',
    type: type as 'reset' | 'verify',
    tokenHash: await hashToken('secret'),
    expiresAt: new Date(expiresAt),
  })
  const reset = resetPassword({
    uow: inMemoryUnitOfWork(fake.repo).uow,
    hasher: { hash: async (p) => `hashed:${p}`, verify: async () => ({ valid: false, needsRehash: false }) },
    breaches: { isBreached: async (p) => p === 'password123' },
    clock: fixedClock(now),
  })
  const passwordHash = () => fake.users[0]!.passwordHash
  return { reset, passwordHash, fake }
}

const cmd = { token: 'secret', password: 'a new long passphrase' }
const refused = (reason: string) => ({ ok: false, error: { kind: 'invalid', field: 'token', reason } })

describe('resetPassword', () => {
  it('US-04.3 sets the new password, revokes every session of the account, then signs it in', async () => {
    const { reset, passwordHash, fake } = await setup()
    const laptop = await startSession(fake.repo, new Date(now), { userId: 'ash' })
    const current = await startSession(fake.repo, new Date(now), { userId: 'ash' })
    const result = await reset({ ...cmd, previousSessionId: current, userAgent: 'Firefox' })
    expect(passwordHash()).toBe('hashed:a new long passphrase')
    const active = fake.sessions.filter((s) => !s.revokedAt)
    expect(active).toHaveLength(1)
    expect(result.ok && (await hashToken(result.value.sessionId))).toBe(active[0]!.idHash)
    for (const old of [laptop, current]) expect(active[0]!.idHash).not.toBe(await hashToken(old))
  })

  it('US-04.2 refuses a link already used', async () => {
    const { reset } = await setup()
    expect(await reset(cmd)).toMatchObject({ ok: true })
    expect(await reset({ ...cmd, password: 'another long passphrase' })).toEqual(refused('invalid'))
  })

  it('US-04.2 refuses an expired link, and leaves the password unchanged', async () => {
    const { reset, passwordHash } = await setup({ expiresAt: now })
    expect(await reset(cmd)).toEqual(refused('expired'))
    expect(passwordHash()).toBe('old')
  })

  it('refuses an unknown token, or a token of another kind', async () => {
    expect(await (await setup()).reset({ ...cmd, token: 'other' })).toEqual(refused('invalid'))
    expect(await (await setup({ type: 'verify' as 'reset' })).reset(cmd)).toEqual(refused('invalid'))
  })

  it('US-01.3 refuses a short or breached new password, and keeps the link usable', async () => {
    const { reset, passwordHash } = await setup()
    expect(await reset({ ...cmd, password: 'short' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'password', reason: 'too_short' },
    })
    expect(await reset({ ...cmd, password: 'password123' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'password', reason: 'breached' },
    })
    expect(passwordHash()).toBe('old')
    expect(await reset(cmd)).toMatchObject({ ok: true })
  })
})
