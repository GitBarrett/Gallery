import { inArray, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { unitOfWorkContract } from '../../tests/contracts/unit-of-work.contract'
import { fixedClock } from '../../tests/fakes/fixed-clock'
import type { Logger } from '../platform/logger'
import { createDb } from './client'
import { onceOnly } from './idempotency'
import { outboxRelay, type QueueProducers } from './outbox'
import { outbox } from './schema'
import { drizzleUnitOfWork } from './unit-of-work'

const db = createDb(process.env.DATABASE_URL!)
const clock = fixedClock('2026-11-21T12:00:00Z')
const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

/** Test queues: record what they receive, or refuse every send. */
function recordingQueues(fails = false) {
  const sent: { topic: string; body: { eventId: string; payload: unknown } }[] = []
  const queue = (topic: string) => ({
    async send(body: unknown) {
      if (fails) throw new Error('queue unavailable')
      sent.push({ topic, body: body as { eventId: string; payload: unknown } })
    },
  })
  const queues: QueueProducers = {
    'photo-process': queue('photo-process'),
    notifications: queue('notifications'),
    emails: queue('emails'),
    feedback: queue('feedback'),
    'account-purge': queue('account-purge'),
  }
  return { queues, sent }
}

afterAll(async () => {
  await db.delete(outbox).where(sql`${outbox.payload}->>'kind' in ('contract', 'relay')`)
  await db.$client.end()
})

unitOfWorkContract('Drizzle and outbox', async ({ queueFails }) => {
  const { queues, sent } = recordingQueues(queueFails)
  return {
    uow: drizzleUnitOfWork(db, () => ({}), outboxRelay(db, queues, clock), logger),
    sent: () => sent.map(({ topic, body }) => ({ topic, payload: body.payload })),
  }
})

describe('outbox relay (T-05b)', () => {
  it('keeps the events a queue refused, then relays each of them once with its outbox id', async () => {
    const down = recordingQueues(true)
    const uow = drizzleUnitOfWork(db, () => ({}), outboxRelay(db, down.queues, clock), logger)
    await uow.run(async (_, publish) => publish({ topic: 'emails', payload: { kind: 'relay' } }))
    const [row] = await db
      .select()
      .from(outbox)
      .where(sql`${outbox.payload}->>'kind' = 'relay'`)
    expect(row!.publishedAt).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith('outbox publish failed, left to the relay', expect.anything())

    const up = recordingQueues()
    const relay = outboxRelay(db, up.queues, clock)
    await relay.publish()
    expect(up.sent).toContainEqual({ topic: 'emails', body: { eventId: row!.id, payload: { kind: 'relay' } } })
    const [after] = await db
      .select()
      .from(outbox)
      .where(inArray(outbox.id, [row!.id]))
    expect(after!.publishedAt).toEqual(clock.now())

    up.sent.length = 0
    await relay.publish()
    expect(up.sent.filter((m) => m.body.eventId === row!.id)).toEqual([])
  })
})

describe('onceOnly: idempotent consumers (T-05b)', () => {
  const eventId = () => crypto.randomUUID()

  it('ignores a second delivery of the same event', async () => {
    const id = eventId()
    const work = vi.fn(async () => {})
    expect(await onceOnly(db, 'test-consumer', id, work)).toBe(true)
    expect(await onceOnly(db, 'test-consumer', id, work)).toBe(false)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('runs the work once when the same event is delivered twice at the same time', async () => {
    const id = eventId()
    const work = vi.fn(async () => {})
    const dbs = [createDb(process.env.DATABASE_URL!), createDb(process.env.DATABASE_URL!)]
    const results = await Promise.all(dbs.map((other) => onceOnly(other, 'test-consumer', id, work)))
    await Promise.all(dbs.map((other) => other.$client.end()))
    expect(results.sort()).toEqual([false, true])
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('lets a failed event be processed again on the next delivery', async () => {
    const id = eventId()
    await expect(
      onceOnly(db, 'test-consumer', id, async () => Promise.reject(new Error('provider down'))),
    ).rejects.toThrow()
    expect(await onceOnly(db, 'test-consumer', id, async () => {})).toBe(true)
  })

  it('keeps consumers apart: the same event is processed once by each of them', async () => {
    const id = eventId()
    expect(await onceOnly(db, 'consumer-a', id, async () => {})).toBe(true)
    expect(await onceOnly(db, 'consumer-b', id, async () => {})).toBe(true)
  })
})

describe('daily purge (T-05b)', () => {
  it('deletes only the events published more than 7 days ago', async () => {
    const day = 86_400_000
    const now = clock.now().getTime()
    const rows = await db
      .insert(outbox)
      .values([
        { topic: 'emails', payload: { kind: 'relay', age: 'old' }, publishedAt: new Date(now - 8 * day) },
        { topic: 'emails', payload: { kind: 'relay', age: 'recent' }, publishedAt: new Date(now - 6 * day) },
        { topic: 'emails', payload: { kind: 'relay', age: 'pending' }, createdAt: new Date(now - 30 * day) },
      ])
      .returning({ id: outbox.id })
    await outboxRelay(db, recordingQueues().queues, clock).purge()
    const left = await db
      .select()
      .from(outbox)
      .where(
        inArray(
          outbox.id,
          rows.map((r) => r.id),
        ),
      )
    expect(left.map((r) => (r.payload as { age: string }).age).sort()).toEqual(['pending', 'recent'])
  })
})
