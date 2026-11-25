import { describe, expect, it } from 'vitest'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { hashToken } from './email-tokens'
import {
  listSessions,
  resolveSession,
  revokeOtherSessions,
  revokeSession,
  SESSION_TTL_MS,
  signout,
  STAFF_SESSION_MS,
  startSession,
} from './sessions'

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

const kael = {
  id: 'kael',
  email: 'kael@example.com',
  username: 'Kaelys',
  passwordHash: 'h',
  locale: 'en' as const,
  termsAcceptedAt: new Date('2026-11-01T00:00:00Z'),
  termsVersion: 'v',
}
const notFound = { ok: false, error: { kind: 'not_found' } }

const ash = {
  id: 'ash',
  username: 'Ash_Barrett',
  role: 'user',
  status: 'active',
  emailVerified: false,
  mfaVerified: false,
  avatar: null,
}

describe('sessions', () => {
  it('US-55.2 marks the session opened by the TOTP, and ends a staff session 12 h after its start', async () => {
    const { repo, users, clock, travel, resolve } = await setup()
    users[0]!.role = 'moderator'
    const pending = await startSession(repo, clock.now(), { userId: 'ash' })
    const verified = await startSession(repo, clock.now(), { userId: 'ash', mfaVerified: true })
    expect(await resolve({ sessionId: pending })).toMatchObject({ actor: { role: 'moderator', mfaVerified: false } })
    expect(await resolve({ sessionId: verified })).toMatchObject({ actor: { mfaVerified: true } })
    travel(STAFF_SESSION_MS - 1)
    expect(await resolve({ sessionId: verified })).not.toBeNull()
    travel(1)
    expect(await resolve({ sessionId: verified })).toBeNull()
    expect(await resolve({ sessionId: pending })).toBeNull()
  })

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

  it('US-03.7 lists my active sessions with a readable device, the current one marked', async () => {
    const { repo, clock, travel } = await setup()
    const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'
    const opened = clock.now()
    const old = await startSession(repo, clock.now(), { userId: 'ash', userAgent: firefox })
    await signout({ repo, clock })({ sessionId: await startSession(repo, clock.now(), { userId: 'ash' }) })
    travel(60_000)
    const current = await startSession(repo, clock.now(), { userId: 'ash' })
    await repo.createUser(kael)
    await startSession(repo, clock.now(), { userId: 'kael' })
    const list = listSessions({ repo, clock })

    expect(await list({ userId: 'ash', sessionId: current })).toEqual([
      {
        id: await hashToken(current),
        device: { browser: null, os: null },
        createdAt: clock.now(),
        lastSeenAt: clock.now(),
        current: true,
      },
      {
        id: await hashToken(old),
        device: { browser: 'Firefox', os: 'Linux' },
        createdAt: opened,
        lastSeenAt: opened,
        current: false,
      },
    ])
    travel(SESSION_TTL_MS)
    expect(await list({ userId: 'ash', sessionId: current })).toEqual([])
  })

  it("US-03.8 revokes one of my sessions; another member's or an unknown one is not found", async () => {
    const { repo, clock, resolve } = await setup()
    const mine = await startSession(repo, clock.now(), { userId: 'ash' })
    await repo.createUser(kael)
    const theirs = await startSession(repo, clock.now(), { userId: 'kael' })
    const revoke = revokeSession({ repo, clock })

    expect(await revoke({ userId: 'ash', id: await hashToken(theirs) })).toEqual(notFound)
    expect(await resolve({ sessionId: theirs })).not.toBeNull()
    expect(await revoke({ userId: 'ash', id: 'unknown' })).toEqual(notFound)
    expect(await revoke({ userId: 'ash', id: await hashToken(mine) })).toEqual({ ok: true, value: undefined })
    expect(await resolve({ sessionId: mine })).toBeNull()
    expect(await revoke({ userId: 'ash', id: await hashToken(mine) })).toEqual(notFound)
  })

  it('US-03.9 revokes all my other sessions and keeps the current one', async () => {
    const { repo, clock, resolve } = await setup()
    const current = await startSession(repo, clock.now(), { userId: 'ash' })
    const phone = await startSession(repo, clock.now(), { userId: 'ash' })
    await repo.createUser(kael)
    const theirs = await startSession(repo, clock.now(), { userId: 'kael' })

    await revokeOtherSessions({ repo, clock })({ userId: 'ash', sessionId: current })
    expect(await resolve({ sessionId: current })).not.toBeNull()
    expect(await resolve({ sessionId: phone })).toBeNull()
    expect(await resolve({ sessionId: theirs })).not.toBeNull()
  })
})
