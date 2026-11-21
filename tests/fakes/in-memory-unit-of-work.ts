import type { DomainEvent, UnitOfWork } from '../../server/platform/unit-of-work'

/**
 * In-memory UnitOfWork for use case tests (10-clean-architecture.md § 5): the scope is given as is,
 * events only leave after the work succeeded. `published` lists what the queues received.
 */
export function inMemoryUnitOfWork<Scope extends object>(scope: Scope, { queueFails = false } = {}) {
  const published: DomainEvent[] = []
  const uow: UnitOfWork<Scope> = {
    async run(work) {
      const pending: DomainEvent[] = []
      const result = await work(scope, (event) => pending.push(event))
      if (!queueFails) published.push(...pending) // like the relay: a refused send does not fail the work
      return result
    },
  }
  return { uow, published, sent: () => published.map(({ topic, payload }) => ({ topic, payload })) }
}
