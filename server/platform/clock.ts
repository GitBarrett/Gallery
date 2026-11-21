/** Clock port: business code never calls `Date.now()` directly (10-clean-architecture.md § 2). */
export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }
