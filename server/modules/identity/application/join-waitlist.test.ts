import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { joinWaitlist } from './join-waitlist'

const clock = fixedClock('2026-11-22T12:00:00Z')

function setup({ inviteOnly = true } = {}) {
  const { repo, waitlist } = inMemoryIdentityRepository()
  let n = 0
  const run = joinWaitlist({
    repo,
    human: { verify: async (token, _ip, action) => token === 'human' && action === 'waitlist' },
    limiter: inMemoryRateLimiter(clock),
    ids: { next: () => `entry-${++n}` },
    inviteOnly: async () => inviteOnly,
  })
  return { run, waitlist }
}

const body = { email: 'ash@example.com', locale: 'fr' as const, turnstileToken: 'human', ip: '203.0.113.7' }
const done = { ok: true, value: undefined }

describe('joinWaitlist', () => {
  it('US-56.4 puts the email on the waiting list, with the same answer when it already is', async () => {
    const { run, waitlist } = setup()
    expect(await run(body)).toEqual(done)
    expect(await run({ ...body, email: 'ASH@example.com', ip: '198.51.100.1' })).toEqual(done)
    expect(waitlist).toEqual([{ id: 'entry-1', email: 'ash@example.com', locale: 'fr' }])
  })

  it('refuses a request whose Turnstile check fails', async () => {
    const { run, waitlist } = setup()
    expect(await run({ ...body, turnstileToken: 'bot' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'turnstileToken', reason: 'failed' },
    })
    expect(waitlist).toEqual([])
  })

  it('allows 3 requests per hour and per IP', async () => {
    const { run } = setup()
    for (const name of ['a', 'b', 'c']) await run({ ...body, email: `${name}@example.com` })
    expect(await run({ ...body, email: 'd@example.com' })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: 3600 },
    })
  })

  it('US-56.3 answers not found once the beta is over', async () => {
    const { run, waitlist } = setup({ inviteOnly: false })
    expect(await run(body)).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(waitlist).toEqual([])
  })
})
