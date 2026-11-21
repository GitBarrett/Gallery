import type { DomainEvent, UnitOfWork } from '../../server/platform/unit-of-work'

/**
 * UnitOfWork en mémoire pour les tests de use cases (10-clean-architecture.md § 5) : le scope est fourni tel quel,
 * les événements ne partent qu'après le succès du travail. `published` liste ce que les files ont reçu.
 */
export function inMemoryUnitOfWork<Scope extends object>(scope: Scope, { queueFails = false } = {}) {
  const published: DomainEvent[] = []
  const uow: UnitOfWork<Scope> = {
    async run(work) {
      const pending: DomainEvent[] = []
      const result = await work(scope, (event) => pending.push(event))
      if (!queueFails) published.push(...pending) // comme le relais : un envoi refusé ne fait pas échouer le travail
      return result
    },
  }
  return { uow, published, sent: () => published.map(({ topic, payload }) => ({ topic, payload })) }
}
