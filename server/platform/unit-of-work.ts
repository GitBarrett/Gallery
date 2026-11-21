import { z } from 'zod'

/** Queues of 03-architecture.md § Files d'attente: an event is published to the queue of its topic. */
export const QUEUE_TOPICS = ['photo-process', 'notifications', 'emails', 'feedback', 'account-purge'] as const
export type QueueTopic = (typeof QUEUE_TOPICS)[number]

/** Business event: written to the outbox with the data, published to its queue after the commit. */
export interface DomainEvent {
  topic: QueueTopic
  payload: Record<string, unknown>
}

/**
 * Transaction port (10-clean-architecture.md § 4): `work` receives the module's transactional repositories and
 * `publish`, which records an event in the same transaction. An exception cancels everything, events included.
 */
export interface UnitOfWork<Scope> {
  run<T>(work: (scope: Scope, publish: (event: DomainEvent) => void) => Promise<T>): Promise<T>
}

/**
 * Body of a queue message: `eventId` (id of the outbox row) stays the same if the relay sends the
 * message again; it is the consumers' idempotency key.
 */
export const eventEnvelope = z.object({ eventId: z.uuid(), payload: z.record(z.string(), z.unknown()) })
export type EventEnvelope = z.infer<typeof eventEnvelope>
