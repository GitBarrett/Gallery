/** Limit of an action (08-securite.md § 8): at most `limit` times per fixed window of `windowSeconds`. */
export interface RateLimitRule {
  name: string
  limit: number
  windowSeconds: number
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Rate limiting port: each call counts one attempt of the `subject` (account or IP) for the rule.
 * Two adapters: database counters (exact, long windows) and the Workers Rate Limiting binding (bursts).
 */
export interface RateLimiter {
  consume(rule: RateLimitRule, subject: string): Promise<RateLimitDecision>
}

/** Fixed window containing `now` (aligned on the Unix epoch) and delay until the next one, in whole seconds ≥ 1. */
export function fixedWindow(now: Date, windowSeconds: number): { start: Date; retryAfterSeconds: number } {
  const size = windowSeconds * 1000
  const start = Math.floor(now.getTime() / size) * size
  return { start: new Date(start), retryAfterSeconds: Math.max(1, Math.ceil((start + size - now.getTime()) / 1000)) }
}

/** Failure counter (sign-in lockout, US-03.3): `peek` tells whether one more attempt would be allowed, without counting. */
export interface AttemptCounter extends RateLimiter {
  peek(rule: RateLimitRule, subject: string): Promise<RateLimitDecision>
}
