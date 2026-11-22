import type { Clock } from '../../server/platform/clock'
import { fixedWindow, type AttemptCounter, type RateLimitRule } from '../../server/platform/rate-limiter'

/** In-memory RateLimiter for use case tests: same fixed window as the database counters, `peek` included. */
export function inMemoryRateLimiter(clock: Clock): AttemptCounter {
  const counts = new Map<string, number>()
  const keyOf = (rule: RateLimitRule, subject: string) => {
    const window = fixedWindow(clock.now(), rule.windowSeconds)
    return { key: `${rule.name}\n${subject}\n${window.start.getTime()}`, retryAfterSeconds: window.retryAfterSeconds }
  }
  return {
    async consume(rule, subject) {
      const { key, retryAfterSeconds } = keyOf(rule, subject)
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      return count <= rule.limit ? { allowed: true } : { allowed: false, retryAfterSeconds }
    },
    async peek(rule, subject) {
      const { key, retryAfterSeconds } = keyOf(rule, subject)
      return (counts.get(key) ?? 0) < rule.limit ? { allowed: true } : { allowed: false, retryAfterSeconds }
    },
  }
}
