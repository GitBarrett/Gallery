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
 * Compteurs exacts en base (`rate_limit_counters`, 08-securite.md § 8) pour les fenêtres longues et les limites
 * strictes : incrément atomique par fenêtre fixe ; la clé est un HMAC de la règle et du sujet (aucune IP en clair).
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
 * Purge horaire des fenêtres échues.
 * shortcut: suppose des fenêtres d'au plus 24 h (vrai pour 08-securite.md § 8), stocker la durée si une règle dépasse
 */
export async function purgeRateLimitCounters(db: Db, clock: Clock): Promise<void> {
  await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, new Date(clock.now().getTime() - 48 * 3600_000)))
}
