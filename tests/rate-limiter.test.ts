import { describe, expect, it } from 'vitest'
import { rateLimiterContract } from './contracts/rate-limiter.contract'
import { inMemoryRateLimiter } from './fakes/in-memory-rate-limiter'
import { fixedClock } from './fakes/fixed-clock'

const rule = { name: 'test', limit: 3, windowSeconds: 3600 }
rateLimiterContract('in-memory fake', async () => inMemoryRateLimiter(fixedClock('2026-11-21T12:00:00Z')), rule)

describe('in-memory fake', () => {
  it('counts each rule separately', async () => {
    const limiter = inMemoryRateLimiter(fixedClock('2026-11-21T12:00:00Z'))
    for (let i = 0; i <= rule.limit; i++) await limiter.consume(rule, 'a')
    expect(await limiter.consume({ ...rule, name: 'other' }, 'a')).toEqual({ allowed: true })
  })
})
