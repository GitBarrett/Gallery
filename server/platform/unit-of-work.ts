import { z } from 'zod'

/** Files de 03-architecture.md § Files d'attente : un événement est publié dans la file de son sujet. */
export const QUEUE_TOPICS = ['photo-process', 'notifications', 'emails', 'feedback', 'account-purge'] as const
export type QueueTopic = (typeof QUEUE_TOPICS)[number]

/** Événement métier : écrit dans l'outbox avec la donnée, publié dans sa file après le commit. */
export interface DomainEvent {
  topic: QueueTopic
  payload: Record<string, unknown>
}

/**
 * Port de transaction (10-clean-architecture.md § 4) : `work` reçoit les repositories transactionnels du module et
 * `publish`, qui enregistre un événement dans la même transaction. Une exception annule tout, événements compris.
 */
export interface UnitOfWork<Scope> {
  run<T>(work: (scope: Scope, publish: (event: DomainEvent) => void) => Promise<T>): Promise<T>
}

/**
 * Corps d'un message de file : `eventId` (identifiant de la ligne d'outbox) reste le même si le relais renvoie le
 * message ; c'est la clé d'idempotence des consommateurs.
 */
export const eventEnvelope = z.object({ eventId: z.uuid(), payload: z.record(z.string(), z.unknown()) })
export type EventEnvelope = z.infer<typeof eventEnvelope>
