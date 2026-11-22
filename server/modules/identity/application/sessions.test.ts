import { describe, expect, it } from 'vitest'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { hashToken } from './email-tokens'
import { resolveSession, SESSION_TTL_MS, signout, startSession } from './sessions'

async function setup() {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash: 'h',
    locale: 'en',
    termsAcceptedAt: new Date('2026-11-01T00:00:00Z'),
    termsVersion: 'v',
  })
  let now = new Date('2026-11-22T12:00:00Z')
  const clock = { now: () => now }
  const travel = (ms: number) => (now = new Date(now.getTime() + ms))
  const resolve = resolveSession({ repo: fake.repo, clock })
  return { ...fake, clock, travel, resolve }
}

const ash = { id: 'ash', username: 'Ash_Barrett', role: 'user', status: 'active', emailVerified: false }

describe('sessions', () => {
  it('US-03.1 opens a 30-day session whose id is random and stored hashed only', async () => {
    const { repo, clock, sessions, resolve } = await setup()
    const id = await startSession(repo, clock.now(), { userId: 'ash', userAgent: 'Firefox' })
    expect(id).toMatch(/^[\w-]{43}$/)
    expect(sessions).toEqual([
      expect.objectContaining({
        idHash: await hashToken(id),
        userId: 'ash',
        expiresAt: new Date(clock.now().getTime() + SESSION_TTL_MS),
        userAgentSummary: 'Firefox',
      }),
    ])
    expect(await resolve({ sessionId: id })).toEqual({ actor: ash, refreshed: false })
  })

  it('US-03.1 issues a new id at each sign-in and revokes the previous one', async () => {
    const { repo, clock, resolve } = await setup()
    const first = await startSession(repo, clock.now(), { userId: 'ash' })
    const second = await startSession(repo, clock.now(), { userId: 'ash', previousSessionId: first })
    expect(second).not.toBe(first)
    expect(await resolve({ sessionId: first })).toBeNull()
    expect(await resolve({ sessionId: second })).not.toBeNull()
  })

  it('US-03.1 slides the 30 days at most once an hour, and ends an unused session', async () => {
    const { repo, clock, travel, resolve } = await setup()
    const id = await startSession(repo, clock.now(), { userId: 'ash' })
    travel(30 * 60_000)
    expect(await resolve({ sessionId: id })).toMatchObject({ refreshed: false })
    travel(30 * 60_000)
    expect(await resolve({ sessionId: id })).toMatchObject({ refreshed: true })
    travel(SESSION_TTL_MS - 1)
    expect(await resolve({ sessionId: id })).toMatchObject({ refreshed: true })
    travel(SESSION_TTL_MS)
    expect(await resolve({ sessionId: id })).toBeNull()
  })

  it('US-03.4 revokes the session on sign-out', async () => {
    const { repo, clock, resolve } = await setup()
    const id = await startSession(repo, clock.now(), { userId: 'ash' })
    await signout({ repo, clock })({ sessionId: id })
    expect(await resolve({ sessionId: id })).toBeNull()
  })

  it('US-03.5 refuses and revokes the session of a banned or deleted account', async () => {
    for (const status of ['banned', 'pending_deletion']) {
      const { repo, clock, users, sessions, resolve } = await setup()
      const id = await startSession(repo, clock.now(), { userId: 'ash' })
      users[0]!.status = status
      expect(await resolve({ sessionId: id })).toBeNull()
      expect(sessions[0]?.revokedAt).toEqual(clock.now())
    }
  })

  it('refuses an unknown session id', async () => {
    const { resolve } = await setup()
    expect(await resolve({ sessionId: 'forged' })).toBeNull()
  })
})
