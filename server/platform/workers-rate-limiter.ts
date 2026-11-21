import type { RateLimiter } from './rate-limiter'

/** Binding Workers Rate Limiting (`[[ratelimits]]` de wrangler.toml), réduit à ce que l'application utilise. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Adaptateur des rafales (fenêtre de 10 ou 60 s comptée par emplacement Cloudflare, donc approximative) : la règle
 * porte le nom du binding et recopie sa limite et sa période, fixées dans wrangler.toml. Sans binding (local, tests
 * Node), tout passe : les limites strictes relèvent des compteurs en base.
 */
export const bindingRateLimiter = (bindings: Record<string, RateLimitBinding | undefined>): RateLimiter => ({
  async consume(rule, subject) {
    const binding = bindings[rule.name]
    if (!binding || (await binding.limit({ key: subject })).success) return { allowed: true }
    return { allowed: false, retryAfterSeconds: rule.windowSeconds }
  },
})
