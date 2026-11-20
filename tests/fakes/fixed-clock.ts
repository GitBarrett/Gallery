import type { Clock } from '../../server/platform/clock'

/** Horloge figée pour les tests (11-strategie-de-tests.md § 3 : aucun `Date.now()` direct). */
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
