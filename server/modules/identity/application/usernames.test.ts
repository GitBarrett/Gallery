import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { getProfile } from './profiles'
import { changeUsername, usernameAvailability } from './usernames'

const day = 86_400_000

async function setup(now = '2026-11-23T12:00:00Z') {
  const fake = inMemoryIdentityRepository()
  for (const [id, username] of [
    ['ash', 'Ash_Barrett'],
    ['kae', 'Kaelys'],
  ] as const)
    await fake.repo.createUser({
      id,
      email: `${id}@example.com`,
      username,
      passwordHash: 'h',
      locale: 'en',
      termsAcceptedAt: new Date('2026-11-01T00:00:00Z'),
      termsVersion: 'v',
    })
  const deps = (at: string) => ({ uow: inMemoryUnitOfWork(fake.repo).uow, repo: fake.repo, clock: fixedClock(at) })
  return {
    fake,
    change: (username: string, at = now) => changeUsername(deps(at))({ userId: 'ash', username }),
    available: (username: string, at = now) => usernameAvailability(deps(at))({ username }),
    profile: (username: string, at = now) => getProfile(deps(at))({ username }),
  }
}

describe('changeUsername', () => {
  it('US-05.1 saves a valid, free username, in its display case', async () => {
    const { change, fake } = await setup()
    expect(await change('Thrall_Fan')).toEqual({ ok: true, value: undefined })
    expect(fake.users[0]).toMatchObject({ username: 'Thrall_Fan' })
  })

  it('US-05.2 refuses a taken (any case), reserved, insulting or malformed username', async () => {
    const { change } = await setup()
    expect(await change('kaelys')).toEqual({ ok: false, error: { kind: 'taken', field: 'username' } })
    for (const [name, reason] of [
      ['admin', 'reserved'],
      ['ab', 'length'],
      ['ash barrett', 'charset'],
    ] as const)
      expect(await change(name)).toEqual({ ok: false, error: { kind: 'invalid', field: 'username', reason } })
  })

  it('US-05.4 allows one change every 30 days', async () => {
    const { change } = await setup()
    expect((await change('First_Name')).ok).toBe(true)
    expect(await change('Second_Name', '2026-12-22T12:00:00Z')).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: day / 1000 },
    })
    expect((await change('Second_Name', '2026-12-23T12:00:00Z')).ok).toBe(true)
  })

  it('US-05.4 keeps the former name for its owner for 90 days: taken for others, profile redirected', async () => {
    const { change, available, profile } = await setup()
    await change('Thrall_Fan')
    expect(await available('ash_barrett')).toEqual({ available: false, reason: 'taken' })
    expect(await profile('ash_barrett')).toMatchObject({ ok: true, value: { username: 'Thrall_Fan' } })
    const after = '2027-02-22T12:00:01Z' // 90 days later
    expect(await available('ash_barrett', after)).toEqual({ available: true })
    expect(await profile('ash_barrett', after)).toEqual({ ok: false, error: { kind: 'not_found' } })
  })

  it('US-05.4 lets the owner take back a former name, without a redirect loop', async () => {
    const { change, profile } = await setup()
    await change('Thrall_Fan')
    expect((await change('Ash_Barrett', '2026-12-24T12:00:00Z')).ok).toBe(true)
    expect(await profile('thrall_fan', '2026-12-24T12:00:00Z')).toMatchObject({ value: { username: 'Ash_Barrett' } })
    expect(await profile('ash_barrett', '2026-12-24T12:00:00Z')).toMatchObject({ value: { username: 'Ash_Barrett' } })
  })
})

describe('usernameAvailability', () => {
  it('US-05.2 says why a username cannot be used, and when it can', async () => {
    const { available } = await setup()
    expect(await available('KAELYS')).toEqual({ available: false, reason: 'taken' })
    expect(await available('moderator')).toEqual({ available: false, reason: 'reserved' })
    expect(await available('x')).toEqual({ available: false, reason: 'length' })
    expect(await available('Thrall_Fan')).toEqual({ available: true })
  })
})
