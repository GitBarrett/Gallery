import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { getAccount } from './email-change'
import { unlinkOAuth } from './linked-accounts'

const clock = fixedClock('2026-11-23T12:00:00Z')

async function setup(passwordHash: string | null, providers: ('google' | 'battlenet')[]) {
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
  for (const provider of providers)
    await fake.repo.linkOAuthAccount({ id: provider, userId: 'ash', provider, subject: `${provider}-ash` })
  const { uow } = inMemoryUnitOfWork(fake.repo)
  const unlink = (provider: 'google' | 'battlenet') => unlinkOAuth({ uow })({ userId: 'ash', provider })
  const providersLeft = () => fake.repo.listOAuthProviders('ash')
  return { fake, unlink, providersLeft }
}

const lastMethod = { ok: false, error: { kind: 'forbidden', reason: 'last_sign_in_method' } }

describe('unlinkOAuth', () => {
  it('US-07.4 unlinks a provider when the account keeps its password', async () => {
    const { unlink, providersLeft } = await setup('hashed:pass', ['google'])
    expect(await unlink('google')).toEqual({ ok: true, value: undefined })
    expect(await providersLeft()).toEqual([])
  })

  it('US-07.4 unlinks a provider when another one stays linked', async () => {
    const { unlink, providersLeft } = await setup(null, ['google', 'battlenet'])
    expect(await unlink('battlenet')).toMatchObject({ ok: true })
    expect(await unlink('google')).toEqual(lastMethod)
    expect(await providersLeft()).toEqual(['google'])
  })

  it('US-07.4 refuses to unlink the only sign-in method of the account', async () => {
    const { unlink, providersLeft } = await setup(null, ['google'])
    expect(await unlink('google')).toEqual(lastMethod)
    expect(await providersLeft()).toEqual(['google'])
  })

  it('US-07.4 answers not found for a provider that is not linked', async () => {
    const { unlink } = await setup('hashed:pass', ['google'])
    expect(await unlink('battlenet')).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})

describe('getAccount', () => {
  it('US-07.4 lists the linked providers of the account', async () => {
    const { fake } = await setup(null, ['battlenet', 'google'])
    expect(await getAccount({ repo: fake.repo })({ userId: 'ash' })).toEqual({
      email: 'ash@example.com',
      hasPassword: false,
      providers: ['google', 'battlenet'],
      notificationPrefs: { likes: true, comments: true, followers: true, contests: true },
    })
  })
})
