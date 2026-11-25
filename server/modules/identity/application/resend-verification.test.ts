import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { anActor } from '../../../../tests/builders/actor'
import { resendVerification } from './resend-verification'

const clock = fixedClock('2026-11-22T12:00:00Z')

function setup() {
  const { uow, sent } = inMemoryUnitOfWork(inMemoryIdentityRepository().repo)
  const run = resendVerification({
    uow,
    human: { verify: async (token, _ip, action) => token === 'human' && action === 'resend_verification' },
    limiter: inMemoryRateLimiter(clock),
  })
  return { run, sent }
}

const ash = anActor({ id: 'ash', emailVerified: false })
const cmd = { actor: ash, turnstileToken: 'human', ip: '203.0.113.7' }
const done = { ok: true, value: undefined }
const verifyEmail = { topic: 'emails', payload: { template: 'verify', userId: 'ash' } }

describe('resendVerification', () => {
  it('US-01.5 sends a new verification link, 3 times an hour per account', async () => {
    const { run, sent } = setup()
    for (const ip of ['a', 'b', 'c']) expect(await run({ ...cmd, ip })).toEqual(done)
    expect(await run({ ...cmd, ip: 'd' })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: 3600 },
    })
    expect(sent()).toEqual([verifyEmail, verifyEmail, verifyEmail])
  })

  it('allows 10 requests an hour per IP', async () => {
    const { run } = setup()
    for (let i = 0; i < 10; i++) await run({ ...cmd, actor: { ...ash, id: `member-${Math.floor(i / 3)}` } })
    expect(await run({ ...cmd, actor: { ...ash, id: 'thrall' } })).toMatchObject({ error: { kind: 'rate_limited' } })
  })

  it('refuses a request whose Turnstile check fails', async () => {
    const { run, sent } = setup()
    expect(await run({ ...cmd, turnstileToken: 'bot' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'turnstileToken', reason: 'failed' },
    })
    expect(sent()).toEqual([])
  })

  it('sends nothing to an email already verified', async () => {
    const { run, sent } = setup()
    expect(await run({ ...cmd, actor: { ...ash, emailVerified: true } })).toEqual(done)
    expect(sent()).toEqual([])
  })
})
