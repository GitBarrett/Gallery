import { inArray, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { rateLimiterContract } from '../../tests/contracts/rate-limiter.contract'
import { fixedClock } from '../../tests/fakes/fixed-clock'
import { createDb } from './client'
import { dbRateLimiter, purgeRateLimitCounters } from './rate-limiter'
import { rateLimitCounters } from './schema'

const db = createDb(process.env.DATABASE_URL!)
const key = 'test-hmac-key'
const noon = fixedClock('2026-11-21T12:30:00Z')
const hourly = { name: 'like', limit: 120, windowSeconds: 3600 }

afterAll(async () => {
  await db.delete(rateLimitCounters).where(sql`${rateLimitCounters.windowStart} < '2026-11-23'`)
  await db.$client.end()
})

rateLimiterContract('database counters', async () => dbRateLimiter(db, key, noon), { ...hourly, limit: 3 })

describe('database counters (T-05c)', () => {
  it('count exactly over a one-hour window, even under concurrent attempts', async () => {
    const limiter = dbRateLimiter(db, key, noon)
    const subject = `account-${crypto.randomUUID()}`
    const decisions = await Promise.all(Array.from({ length: 130 }, () => limiter.consume(hourly, subject)))
    expect(decisions.filter((d) => d.allowed)).toHaveLength(120)
    expect(decisions.find((d) => !d.allowed)).toEqual({ allowed: false, retryAfterSeconds: 1800 })
  })

  it('start again in the next window', async () => {
    const subject = `account-${crypto.randomUUID()}`
    const rule = { ...hourly, limit: 1 }
    await dbRateLimiter(db, key, noon).consume(rule, subject)
    expect((await dbRateLimiter(db, key, noon).consume(rule, subject)).allowed).toBe(false)
    expect(await dbRateLimiter(db, key, fixedClock('2026-11-21T13:00:00Z')).consume(rule, subject)).toEqual({
      allowed: true,
    })
  })

  it('store neither the subject nor the action in clear (HMAC key)', async () => {
    const subject = `203.0.113.${Math.floor(Math.random() * 250)}`
    await dbRateLimiter(db, key, noon).consume({ ...hourly, name: 'signup' }, subject)
    const rows = await db
      .select()
      .from(rateLimitCounters)
      .where(sql`${rateLimitCounters.windowStart} = '2026-11-21T12:00:00Z'`)
    expect(rows.some((r) => r.keyHmac.includes(subject) || r.keyHmac.includes('signup'))).toBe(false)
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.keyHmac))).toBe(true)
  })

  it('purge the windows that ended more than a day ago', async () => {
    const at = (iso: string) => new Date(iso)
    await db.insert(rateLimitCounters).values([
      { keyHmac: 'purge-old', windowStart: at('2026-11-20T10:00:00Z'), count: 1 },
      { keyHmac: 'purge-recent', windowStart: at('2026-11-21T10:00:00Z'), count: 1 },
    ])
    await purgeRateLimitCounters(db, fixedClock('2026-11-22T12:00:00Z'))
    const left = await db
      .select({ key: rateLimitCounters.keyHmac })
      .from(rateLimitCounters)
      .where(inArray(rateLimitCounters.keyHmac, ['purge-old', 'purge-recent']))
    expect(left).toEqual([{ key: 'purge-recent' }])
  })
})
