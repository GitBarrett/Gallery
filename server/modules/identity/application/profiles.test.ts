import { describe, expect, it } from 'vitest'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { getProfile } from './profiles'

async function setup(status = 'active', createdAt = new Date('2026-11-01T10:00:00Z')) {
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
  Object.assign(fake.users[0]!, { status, bio: 'Night elf hunter.', createdAt })
  await fake.repo.setSocialLinks('ash', [
    { platform: 'twitch', handle: 'Ash_Barrett' },
    { platform: 'discord', handle: 'ash.barrett' },
    { platform: 'website', handle: 'https://ash.example.com/shots' },
    { platform: 'x', handle: 'not a valid handle' }, // stored before a rule change: no link
  ])
  return getProfile({ repo: fake.repo, clock: fixedClock('2026-11-23T12:00:00Z') })
}

describe('getProfile', () => {
  it('US-05.3 gives the public profile of a username in any case, in its display case', async () => {
    const run = await setup()
    expect(await run({ username: 'ash_barrett' })).toEqual({
      ok: true,
      value: expect.objectContaining({
        username: 'Ash_Barrett',
        bio: 'Night elf hunter.',
        memberSince: new Date('2026-11-01T10:00:00Z'),
      }),
    })
  })

  it('US-82.4 gives the social links built by the server from the fixed templates, Discord without a link', async () => {
    const result = await (await setup())({ username: 'Ash_Barrett' })
    expect(result.ok && result.value.socialLinks).toEqual([
      { platform: 'twitch', label: 'Ash_Barrett', url: 'https://twitch.tv/Ash_Barrett' },
      { platform: 'discord', label: 'ash.barrett', url: null },
      { platform: 'website', label: 'ash.example.com', url: 'https://ash.example.com/shots' },
    ])
  })

  it('US-82.5 hides the social links of a suspended account or one created less than 7 days ago', async () => {
    const links = async (status: string, createdAt: string) => {
      const result = await (await setup(status, new Date(createdAt)))({ username: 'Ash_Barrett' })
      return result.ok ? result.value.socialLinks.length : null
    }
    expect(await links('suspended', '2026-11-01T10:00:00Z')).toBe(0)
    expect(await links('active', '2026-11-16T12:00:01Z')).toBe(0) // 1 s short of 7 days
    expect(await links('active', '2026-11-16T12:00:00Z')).toBe(3)
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
