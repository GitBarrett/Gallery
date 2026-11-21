import type { Clock } from '../../server/platform/clock'

/** Frozen clock for tests (11-strategie-de-tests.md § 3: no direct `Date.now()`). */
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
