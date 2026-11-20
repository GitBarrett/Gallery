/** Port d'horloge : le code métier n'appelle jamais `Date.now()` directement (10-clean-architecture.md § 2). */
export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }
