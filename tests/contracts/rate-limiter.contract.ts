import { describe, expect, it } from 'vitest'
import type { AttemptCounter, RateLimiter, RateLimitRule } from '../../server/platform/rate-limiter'

// Contract of the RateLimiter port (11-strategie-de-tests.md § 4): checked on the fake, the database and the binding.
// `rule` must match what the implementation can limit (binding: limit set in wrangler.toml).
export function rateLimiterContract(name: string, make: () => Promise<RateLimiter>, rule: RateLimitRule) {
  describe(`RateLimiter contract: ${name}`, () => {
    const subject = () => `subject-${crypto.randomUUID()}`

    it('allows up to the limit, then refuses with a retry delay within the window', async () => {
      const limiter = await make()
      const who = subject()
      for (let i = 0; i < rule.limit; i++) expect(await limiter.consume(rule, who)).toEqual({ allowed: true })
      const refused = await limiter.consume(rule, who)
      expect(refused.allowed).toBe(false)
      if (!refused.allowed) {
        expect(refused.retryAfterSeconds).toBeGreaterThan(0)
        expect(refused.retryAfterSeconds).toBeLessThanOrEqual(rule.windowSeconds)
      }
    })

    it('counts each subject separately', async () => {
      const limiter = await make()
      const first = subject()
      for (let i = 0; i <= rule.limit; i++) await limiter.consume(rule, first)
      expect(await limiter.consume(rule, subject())).toEqual({ allowed: true })
    })
  })
}

/** Contract of the AttemptCounter port (failure counters, US-03.3): `peek` reads without counting. */
export function attemptCounterContract(name: string, make: () => Promise<AttemptCounter>, rule: RateLimitRule) {
  describe(`AttemptCounter contract: ${name}`, () => {
    it('peeks without counting, and refuses once the limit is reached', async () => {
      const counter = await make()
      const who = `subject-${crypto.randomUUID()}`
      for (let i = 0; i < rule.limit; i++) {
        expect(await counter.peek(rule, who)).toEqual({ allowed: true })
        await counter.consume(rule, who)
      }
      const reached = await counter.peek(rule, who)
      expect(reached.allowed).toBe(false)
      expect(await counter.peek(rule, who)).toEqual(reached)
      expect(await counter.peek(rule, `subject-${crypto.randomUUID()}`)).toEqual({ allowed: true })
    })
  })
}
