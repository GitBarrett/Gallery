import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../tests/fakes/fixed-clock'
import { baseQueueName, dispatchBatch, dispatchCron, heartbeatCron, type QueueMessage } from './jobs'
import type { Logger } from './logger'

const message = (id: string, body: unknown) => {
  const state = { acked: false, retried: false }
  const msg: QueueMessage = {
    id,
    body,
    attempts: 1,
    ack: () => (state.acked = true),
    retry: () => (state.retried = true),
  }
  return { msg, state }
}
const silent = (): Logger & { lines: string[] } => {
  const lines: string[] = []
  const push = (msg: string) => void lines.push(msg)
  return { lines, info: push, warn: push, error: push }
}

describe('baseQueueName', () => {
  it('drops the preview suffix so previews reuse the production consumers', () => {
    expect(baseQueueName('emails-pr-42')).toBe('emails')
    expect(baseQueueName('photo-process')).toBe('photo-process')
  })
})

describe('dispatchBatch', () => {
  it('hands each message to the consumer of its queue and acknowledges it', async () => {
    const seen: unknown[] = []
    const a = message('1', { n: 1 })
    await dispatchBatch(
      { queue: 'emails-pr-7', messages: [a.msg] },
      { emails: async (body) => void seen.push(body) },
      silent(),
    )
    expect(seen).toEqual([{ n: 1 }])
    expect(a.state).toEqual({ acked: true, retried: false })
  })

  it('retries only the message that failed, not the whole batch', async () => {
    const good = message('1', { ok: true })
    const bad = message('2', { ok: false })
    const handler = async (body: unknown) => {
      if (!(body as { ok: boolean }).ok) throw new Error('provider down')
    }
    const logger = silent()
    await dispatchBatch({ queue: 'emails', messages: [good.msg, bad.msg] }, { emails: handler }, logger)
    expect(good.state).toEqual({ acked: true, retried: false })
    expect(bad.state).toEqual({ acked: false, retried: true })
    expect(logger.lines).toContain('message failed')
  })

  it('keeps messages of a queue without consumer for a later retry, then the DLQ', async () => {
    const orphan = message('1', {})
    await dispatchBatch({ queue: 'feedback', messages: [orphan.msg] }, {}, silent())
    expect(orphan.state).toEqual({ acked: false, retried: true })
  })

  it('handles the heartbeat itself on any queue, without calling the consumer', async () => {
    const beat = message('1', { type: 'heartbeat', at: '2026-11-20T22:00:00.000Z' })
    const logger = silent()
    await dispatchBatch({ queue: 'notifications', messages: [beat.msg] }, {}, logger)
    expect(beat.state.acked).toBe(true)
    expect(logger.lines).toContain('heartbeat processed')
  })
})

describe('dispatchCron', () => {
  it('runs every handler of the cron and fails after logging if one fails', async () => {
    const ran: string[] = []
    const logger = silent()
    const run = dispatchCron(
      '0 * * * *',
      {
        '0 * * * *': [
          async () => void ran.push('a'),
          async () => {
            throw new Error('boom')
          },
          async () => void ran.push('c'),
        ],
      },
      logger,
    )
    await expect(run).rejects.toThrow('1 cron handler(s) failed')
    expect(ran).toEqual(['a', 'c'])
    expect(logger.lines).toContain('cron handler failed')
  })

  it('warns about a cron without handler', async () => {
    const logger = silent()
    await dispatchCron('15 3 * * *', {}, logger)
    expect(logger.lines).toContain('no handler for cron')
  })
})

describe('heartbeatCron', () => {
  it('sends a timestamped heartbeat message', async () => {
    const sent: unknown[] = []
    await heartbeatCron({ send: async (body) => void sent.push(body) }, fixedClock('2026-11-20T22:00:00Z'))()
    expect(sent).toEqual([{ type: 'heartbeat', at: '2026-11-20T22:00:00.000Z' }])
  })
})
