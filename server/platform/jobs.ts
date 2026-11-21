import type { Clock } from './clock'
import type { Logger } from './logger'

/** Message de Cloudflare Queues, réduit à ce que l'application utilise. */
export interface QueueMessage {
  id: string
  body: unknown
  attempts: number
  ack(): void
  retry(): void
}
export type MessageHandler = (body: unknown, message: QueueMessage) => Promise<void>
export type CronHandler = () => Promise<unknown>

/** `emails-pr-42` → `emails` : les previews utilisent les consommateurs de production (ADR-013). */
export const baseQueueName = (queue: string) => queue.replace(/-pr-\d+$/, '')

const isHeartbeat = (body: unknown) => (body as { type?: unknown } | null)?.type === 'heartbeat'

/**
 * Aiguille chaque message vers le consommateur de sa file et l'acquitte un par un (T-00f) :
 * un échec ne renvoie que ce message ; après `max_retries`, Cloudflare le place dans la DLQ.
 */
export async function dispatchBatch(
  batch: { queue: string; messages: readonly QueueMessage[] },
  handlers: Record<string, MessageHandler>,
  logger: Logger,
): Promise<void> {
  const queue = baseQueueName(batch.queue)
  const handler = handlers[queue]
  for (const message of batch.messages) {
    if (isHeartbeat(message.body)) {
      logger.info('heartbeat processed', { queue, at: (message.body as { at?: unknown }).at })
      message.ack()
    } else if (!handler) {
      logger.error('no consumer for queue', { queue, messageId: message.id })
      message.retry()
    } else {
      try {
        await handler(message.body, message)
        message.ack()
      } catch (error) {
        logger.error('message failed', { queue, messageId: message.id, attempts: message.attempts, error })
        message.retry()
      }
    }
  }
}

/** Lance tous les traitements d'un cron, même si l'un échoue, puis signale l'échec à Cloudflare. */
export async function dispatchCron(
  cron: string,
  handlers: Record<string, CronHandler[]>,
  logger: Logger,
): Promise<void> {
  const list = handlers[cron] ?? []
  if (list.length === 0) logger.warn('no handler for cron', { cron })
  const failed = (await Promise.allSettled(list.map((handler) => handler()))).filter((r) => r.status === 'rejected')
  for (const failure of failed) logger.error('cron handler failed', { cron, error: failure.reason })
  if (failed.length) throw new Error(`${failed.length} cron handler(s) failed`)
}

/** Battement horaire : prouve en continu que la chaîne cron → file → consommateur fonctionne. */
export const heartbeatCron =
  (queue: { send(body: unknown): Promise<unknown> }, clock: Clock): CronHandler =>
  () =>
    queue.send({ type: 'heartbeat', at: clock.now().toISOString() })
