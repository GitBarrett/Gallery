import type { Clock } from '../../server/platform/clock'
import { fixedWindow, type RateLimiter } from '../../server/platform/rate-limiter'

/** RateLimiter en mémoire pour les tests de use cases : même fenêtre fixe que les compteurs en base. */
export function inMemoryRateLimiter(clock: Clock): RateLimiter {
  const counts = new Map<string, number>()
  return {
    async consume(rule, subject) {
      const window = fixedWindow(clock.now(), rule.windowSeconds)
      const key = `${rule.name}\n${subject}\n${window.start.getTime()}`
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      return count <= rule.limit ? { allowed: true } : { allowed: false, retryAfterSeconds: window.retryAfterSeconds }
    },
  }
}
