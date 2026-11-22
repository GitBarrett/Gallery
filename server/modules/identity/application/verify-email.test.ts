import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { hashToken } from './email-tokens'
import { verifyEmail } from './verify-email'

const now = '2026-11-22T12:00:00Z'

async function setup(expiresAt = '2026-11-23T11:00:00Z') {
  const fake = inMemoryIdentityRepository()
  for (const id of ['ash', 'thrall']) {
    await fake.repo.createUser({
      id,
      email: `${id}@example.com`,
      username: id,
      passwordHash: 'h',
      locale: 'en',
      termsAcceptedAt: new Date(now),
      termsVersion: 'v',
    })
    await fake.repo.createEmailToken({
      id: `token-${id}`,
      userId: id,
      type: 'verify',
      tokenHash: await hashToken(`secret-${id}`),
      expiresAt: new Date(expiresAt),
    })
  }
  const verify = verifyEmail({ uow: inMemoryUnitOfWork(fake.repo).uow, clock: fixedClock(now) })
  const verifiedAt = (id: string) => fake.users.find((u) => u.id === id)!.emailVerifiedAt
  return { verify, verifiedAt, sessions: fake.sessions }
}

describe('verifyEmail', () => {
  it('US-01.4 verifies the email of the link owner only, then the link becomes unusable', async () => {
    const { verify, verifiedAt } = await setup()
    expect(await verify({ token: 'secret-ash' })).toMatchObject({ ok: true })
    expect(verifiedAt('ash')).toEqual(new Date(now))
    expect(verifiedAt('thrall')).toBeNull()
    expect(await verify({ token: 'secret-ash' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'token', reason: 'invalid' },
    })
  })

  it('US-01.1 signs the link owner in, replacing the session the browser had', async () => {
    const { verify, sessions } = await setup()
    const result = await verify({ token: 'secret-thrall', userAgent: 'Firefox', previousSessionId: 'old' })
    expect(result.ok && (await hashToken(result.value.sessionId))).toBe(sessions[0]?.idHash)
    expect(sessions).toEqual([expect.objectContaining({ userId: 'thrall', userAgentSummary: 'Firefox' })])
  })

  it('US-01.5 reports an expired link, so that a new one can be requested', async () => {
    const { verify, verifiedAt } = await setup(now)
    expect(await verify({ token: 'secret-ash' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'token', reason: 'expired' },
    })
    expect(verifiedAt('ash')).toBeNull()
  })

  it('refuses an unknown token', async () => {
    const { verify } = await setup()
    expect(await verify({ token: 'guess' })).toMatchObject({ error: { reason: 'invalid' } })
  })
})
