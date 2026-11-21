import { describe, expect, it } from 'vitest'
import { rateLimiterContract } from '../../tests/contracts/rate-limiter.contract'
import { bindingRateLimiter, type RateLimitBinding } from './workers-rate-limiter'

const rule = { name: 'RATE_LIMITER_TEST', limit: 3, windowSeconds: 60 }

/** Binding simulé : compte par clé jusqu'à la limite déclarée dans wrangler.toml. */
function fakeBinding(limit: number): RateLimitBinding {
  const counts = new Map<string, number>()
  return {
    async limit({ key }) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return { success: counts.get(key)! <= limit }
    },
  }
}

rateLimiterContract(
  'Workers Rate Limiting binding',
  async () => bindingRateLimiter({ [rule.name]: fakeBinding(3) }),
  rule,
)

describe('bindingRateLimiter', () => {
  it('lets everything through when the binding is absent (local, Node tests)', async () => {
    const limiter = bindingRateLimiter({})
    for (let i = 0; i < 10; i++) expect(await limiter.consume(rule, 'ip')).toEqual({ allowed: true })
  })
})
