import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { forgotPassword } from './forgot-password'

const clock = fixedClock('2026-11-22T12:00:00Z')

async function setup() {
  const fake = inMemoryIdentityRepository()
  for (const id of ['ash', 'banned']) {
    await fake.repo.createUser({
      id,
      email: `${id}@example.com`,
      username: id,
      passwordHash: 'h',
      locale: 'en',
      termsAcceptedAt: clock.now(),
      termsVersion: 'v',
    })
  }
  fake.users.find((u) => u.id === 'banned')!.status = 'banned'
  const { uow, sent } = inMemoryUnitOfWork(fake.repo)
  const run = forgotPassword({
    repo: fake.repo,
    uow,
    human: { verify: async (token, _ip, action) => token === 'human' && action === 'forgot_password' },
    limiter: inMemoryRateLimiter(clock),
  })
  return { run, sent }
}

const cmd = { email: 'Ash@Example.com', turnstileToken: 'human', ip: '203.0.113.7' }
const done = { ok: true, value: undefined }
const resetEmail = { topic: 'emails', payload: { template: 'reset', userId: 'ash' } }

describe('forgotPassword', () => {
  it('US-04.1 sends a reset link if the account exists, with the same answer in every case', async () => {
    const { run, sent } = await setup()
    expect(await run(cmd)).toEqual(done)
    expect(await run({ ...cmd, email: 'nobody@example.com' })).toEqual(done)
    expect(sent()).toEqual([resetEmail])
  })

  it('US-04.4 silently ignores more than 3 requests an hour for an email', async () => {
    const { run, sent } = await setup()
    for (const ip of ['a', 'b', 'c', 'd']) expect(await run({ ...cmd, ip })).toEqual(done)
    expect(await run({ ...cmd, email: 'ASH@example.com', ip: 'e' })).toEqual(done)
    expect(sent()).toEqual([resetEmail, resetEmail, resetEmail])
  })

  it('US-04.4 silently ignores more than 10 requests an hour from an IP', async () => {
    const { run, sent } = await setup()
    for (let i = 0; i < 10; i++) await run({ ...cmd, email: `nobody.${i}@example.com` })
    expect(await run(cmd)).toEqual(done)
    expect(sent()).toEqual([])
  })

  it('refuses a request whose Turnstile check fails', async () => {
    const { run, sent } = await setup()
    expect(await run({ ...cmd, turnstileToken: 'bot' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'turnstileToken', reason: 'failed' },
    })
    expect(sent()).toEqual([])
  })

  it('sends nothing to a banned account, with the same answer', async () => {
    const { run, sent } = await setup()
    expect(await run({ ...cmd, email: 'banned@example.com' })).toEqual(done)
    expect(sent()).toEqual([])
  })
})
