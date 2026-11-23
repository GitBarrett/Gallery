import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { getSocialLinks, setSocialLinks } from './social-links'

const clock = fixedClock('2026-11-23T12:00:00Z')
const actor = { id: 'ash', username: 'Ash_Barrett' }

async function setup() {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash: null,
    locale: 'en',
    termsAcceptedAt: clock.now(), // under 7 days: hidden on the profile, still in the settings (US-82.5)
    termsVersion: 'v',
  })
  const { uow } = inMemoryUnitOfWork(fake.repo)
  const save = setSocialLinks({ uow, limiter: inMemoryRateLimiter(clock) })
  const read = () => getSocialLinks({ repo: fake.repo })({ actor })
  return { save, read }
}

describe('setSocialLinks', () => {
  it('US-82.1 stores the identifiers and replaces the whole list, the settings read them back', async () => {
    const { save, read } = await setup()
    await save({ actor, links: [{ platform: 'x', handle: 'ash' }] })
    const links = [
      { platform: 'website', handle: 'https://ash.example.com/shots' },
      { platform: 'twitch', handle: 'luneblade' },
    ] as const
    expect(await save({ actor, links: [...links] })).toEqual({ ok: true, value: undefined })
    expect(await read()).toEqual([links[1], links[0]]) // fixed order of the networks
  })

  it('US-82.2 refuses an identifier out of the network format or with an insult, naming the network', async () => {
    const { save, read } = await setup()
    const refused = (platform: string, reason: string) => ({
      ok: false,
      error: { kind: 'invalid', field: platform, reason },
    })
    expect(await save({ actor, links: [{ platform: 'twitch', handle: 'https://twitch.tv/x' }] })).toEqual(
      refused('twitch', 'format'),
    )
    expect(await save({ actor, links: [{ platform: 'reddit', handle: 'the_bastard' }] })).toEqual(
      refused('reddit', 'insult'),
    )
    expect(await read()).toEqual([])
  })

  it('US-82.3 accepts only an https website, not an IP or a shortener', async () => {
    const { save } = await setup()
    for (const handle of ['http://ash.example.com', 'https://192.168.0.1', 'https://bit.ly/abc'])
      expect(await save({ actor, links: [{ platform: 'website', handle }] })).toMatchObject({ ok: false })
  })

  it('US-82.1 refuses after 20 saves within an hour', async () => {
    const { save } = await setup()
    for (let i = 0; i < 20; i++) await save({ actor, links: [] })
    expect(await save({ actor, links: [] })).toMatchObject({ ok: false, error: { kind: 'rate_limited' } })
  })
})
