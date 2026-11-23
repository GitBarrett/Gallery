import { describe, expect, it } from 'vitest'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { getProfile } from './profiles'

async function setup(status = 'active') {
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
  Object.assign(fake.users[0]!, { status, bio: 'Night elf hunter.', createdAt: new Date('2026-11-01T10:00:00Z') })
  return getProfile({ repo: fake.repo, clock: fixedClock('2026-11-23T12:00:00Z') })
}

describe('getProfile', () => {
  it('US-05.3 gives the public profile of a username in any case, in its display case', async () => {
    const run = await setup()
    expect(await run({ username: 'ash_barrett' })).toEqual({
      ok: true,
      value: { username: 'Ash_Barrett', bio: 'Night elf hunter.', memberSince: new Date('2026-11-01T10:00:00Z') },
    })
  })

  it('US-05.3 shows a suspended member, not a banned one nor one being deleted', async () => {
    expect((await (await setup('suspended'))({ username: 'Ash_Barrett' })).ok).toBe(true)
    for (const status of ['banned', 'pending_deletion'])
      expect(await (await setup(status))({ username: 'Ash_Barrett' })).toEqual({
        ok: false,
        error: { kind: 'not_found' },
      })
  })

  it('answers not found for an unknown username', async () => {
    expect(await (await setup())({ username: 'nobody' })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})
