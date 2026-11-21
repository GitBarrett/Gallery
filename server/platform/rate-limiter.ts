/** Limite d'une action (08-securite.md § 8) : au plus `limit` fois par fenêtre fixe de `windowSeconds`. */
export interface RateLimitRule {
  name: string
  limit: number
  windowSeconds: number
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Port de limitation de débit : chaque appel compte une tentative du `subject` (compte ou IP) pour la règle.
 * Deux adaptateurs : compteurs en base (exacts, fenêtres longues) et binding Workers Rate Limiting (rafales).
 */
export interface RateLimiter {
  consume(rule: RateLimitRule, subject: string): Promise<RateLimitDecision>
}

/** Fenêtre fixe contenant `now` (alignée sur l'époque Unix) et délai jusqu'à la suivante, en secondes entières ≥ 1. */
export function fixedWindow(now: Date, windowSeconds: number): { start: Date; retryAfterSeconds: number } {
  const size = windowSeconds * 1000
  const start = Math.floor(now.getTime() / size) * size
  return { start: new Date(start), retryAfterSeconds: Math.max(1, Math.ceil((start + size - now.getTime()) / 1000)) }
}
