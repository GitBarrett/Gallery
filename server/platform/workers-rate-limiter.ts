import type { RateLimiter } from './rate-limiter'

/** Workers Rate Limiting binding (`[[ratelimits]]` of wrangler.toml), reduced to what the application uses. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Burst adapter (window of 10 or 60 s counted per Cloudflare location, hence approximate): the rule carries
 * the binding name and copies its limit and period, set in wrangler.toml. Without a binding (local, Node
 * tests), everything passes: strict limits belong to the database counters.
 */
export const bindingRateLimiter = (bindings: Record<string, RateLimitBinding | undefined>): RateLimiter => ({
  async consume(rule, subject) {
    const binding = bindings[rule.name]
    if (!binding || (await binding.limit({ key: subject })).success) return { allowed: true }
    return { allowed: false, retryAfterSeconds: rule.windowSeconds }
  },
})
