import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { confirmEmailChange, getAccount, requestEmailChange } from './email-change'
import { hashToken } from './email-tokens'

const clock = fixedClock('2026-11-23T12:00:00Z')

async function setup({
  email = 'ash@example.com' as string | null,
  passwordHash = 'hashed:correct horse' as string | null,
} = {}) {
  const fake = inMemoryIdentityRepository()
  const base = { locale: 'en' as const, termsAcceptedAt: clock.now(), termsVersion: 'v' }
  await fake.repo.createUser({ ...base, id: 'ash', email, username: 'Ash_Barrett', passwordHash })
  await fake.repo.createUser({ ...base, id: 'thrall', email: 'thrall@example.com', username: 'Thrall', passwordHash })
  const { uow, sent } = inMemoryUnitOfWork(fake.repo)
  const request = requestEmailChange({
    repo: fake.repo,
    uow,
    hasher: {
      hash: async (p) => `hashed:${p}`,
      verify: async (p, s) => ({ valid: s === `hashed:${p}`, needsRehash: false }),
    },
    limiter: inMemoryRateLimiter(clock),
  })
  const confirm = confirmEmailChange({ uow, clock })
  // The link the `emails` consumer would mail to the new address
  const link = async (newEmail: string, expiresAt = '2026-11-24T12:00:00Z') => {
    await fake.repo.createEmailToken({
      id: crypto.randomUUID(),
      userId: 'ash',
      type: 'email_change',
      tokenHash: await hashToken(newEmail),
      expiresAt: new Date(expiresAt),
      newEmail,
    })
    return newEmail
  }
  const user = () => fake.users.find((u) => u.id === 'ash')!
  return { fake, request, confirm, link, sent, user }
}

const cmd = { userId: 'ash', newEmail: 'ash.new@example.com', currentPassword: 'correct horse' }
const invalid = (field: string, reason: string) => ({ ok: false, error: { kind: 'invalid', field, reason } })

describe('requestEmailChange', () => {
  it('US-07.2 sends a link to the new address and an alert to the old one; the email does not change yet', async () => {
    const { request, sent, user } = await setup()
    expect(await request(cmd)).toEqual({ ok: true, value: undefined })
    expect(sent()).toEqual([
      { topic: 'emails', payload: { template: 'email_change', userId: 'ash', newEmail: 'ash.new@example.com' } },
      { topic: 'emails', payload: { template: 'email_change_alert', userId: 'ash' } },
    ])
    expect(user().email).toBe('ash@example.com')
  })

  it('US-07.2 asks for the current password, when the account has one', async () => {
    const { request, sent } = await setup()
    expect(await request({ ...cmd, currentPassword: 'wrong guess' })).toEqual(invalid('currentPassword', 'wrong'))
    expect(await request({ ...cmd, currentPassword: undefined })).toEqual(invalid('currentPassword', 'wrong'))
    expect(sent()).toEqual([])
  })

  it('US-07.2 needs no password for an account without one, nor an alert without an old address (Battle.net)', async () => {
    const { request, sent } = await setup({ email: null, passwordHash: null })
    expect(await request({ ...cmd, currentPassword: undefined })).toMatchObject({ ok: true })
    expect(sent()).toEqual([
      { topic: 'emails', payload: { template: 'email_change', userId: 'ash', newEmail: 'ash.new@example.com' } },
    ])
  })

  it('US-07.2 answers the same for an address of another account, and sends nothing (no enumeration)', async () => {
    const { request, sent } = await setup()
    expect(await request({ ...cmd, newEmail: 'THRALL@example.com' })).toEqual({ ok: true, value: undefined })
    expect(sent()).toEqual([])
    expect(await request({ ...cmd, newEmail: 'Ash@example.com' })).toEqual(invalid('newEmail', 'same'))
  })

  it('US-07.2 refuses a 4th request within an hour, wrong passwords included', async () => {
    const { request } = await setup()
    for (let i = 0; i < 3; i++) await request({ ...cmd, currentPassword: `wrong ${i}` })
    expect(await request(cmd)).toMatchObject({ ok: false, error: { kind: 'rate_limited' } })
  })
})

describe('confirmEmailChange', () => {
  it('US-07.2 sets the new email, verified, once; the other links of the account stop working', async () => {
    const { confirm, link, user, fake } = await setup()
    const token = await link('ash.new@example.com')
    const other = await link('ash.other@example.com')
    await fake.repo.createEmailToken({
      id: 'reset-1',
      userId: 'ash',
      type: 'reset',
      tokenHash: 'reset-hash',
      expiresAt: new Date('2026-11-23T13:00:00Z'),
    })
    expect(await confirm({ token })).toEqual({ ok: true, value: undefined })
    expect(user()).toMatchObject({ email: 'ash.new@example.com', emailVerifiedAt: clock.now() })
    expect(await confirm({ token })).toEqual(invalid('token', 'invalid'))
    expect(await confirm({ token: other })).toEqual(invalid('token', 'invalid'))
    expect(fake.tokens.find((t) => t.id === 'reset-1')?.usedAt).toEqual(clock.now()) // the old mailbox loses its reset link
  })

  it('US-07.2 refuses an expired link, or one whose address was taken in the meantime', async () => {
    const { confirm, link, user } = await setup()
    expect(await confirm({ token: await link('late@example.com', '2026-11-23T12:00:00Z') })).toEqual(
      invalid('token', 'expired'),
    )
    expect(await confirm({ token: await link('thrall@example.com') })).toEqual(invalid('token', 'taken'))
    expect(user().email).toBe('ash@example.com')
  })
})

describe('getAccount', () => {
  it('US-07.2 gives the email of the account and whether it has a password', async () => {
    const { fake } = await setup()
    expect(await getAccount({ repo: fake.repo })({ userId: 'ash' })).toEqual({
      email: 'ash@example.com',
      hasPassword: true,
      providers: [],
      notificationPrefs: { likes: true, comments: true, followers: true, contests: true },
    })
  })
})
