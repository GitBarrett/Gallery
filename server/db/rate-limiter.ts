import { lt, sql } from 'drizzle-orm'
import type { Clock } from '../platform/clock'
import { fixedWindow, type RateLimiter } from '../platform/rate-limiter'
import type { Db } from './client'
import { rateLimitCounters } from './schema'

const encoder = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  return Array.from(signature, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Exact database counters (`rate_limit_counters`, 08-securite.md § 8) for long windows and strict limits:
 * atomic increment per fixed window; the key is an HMAC of the rule and the subject (no IP in clear).
 */
export function dbRateLimiter(db: Db, hmacKey: string, clock: Clock): RateLimiter {
  return {
    async consume(rule, subject) {
      const window = fixedWindow(clock.now(), rule.windowSeconds)
      const [row] = await db
        .insert(rateLimitCounters)
        .values({ keyHmac: await hmacHex(hmacKey, `${rule.name}\n${subject}`), windowStart: window.start, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimitCounters.keyHmac, rateLimitCounters.windowStart],
          set: { count: sql`${rateLimitCounters.count} + 1` },
        })
        .returning({ count: rateLimitCounters.count })
      return row!.count <= rule.limit
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: window.retryAfterSeconds }
    },
  }
}

/**
 * Hourly purge of ended windows.
 * shortcut: assumes windows of at most 24 h (true for 08-securite.md § 8), store the length if a rule exceeds it
 */
export async function purgeRateLimitCounters(db: Db, clock: Clock): Promise<void> {
  await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, new Date(clock.now().getTime() - 48 * 3600_000)))
}
