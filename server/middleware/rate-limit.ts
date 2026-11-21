import type { Bindings } from '../platform/bindings'
import { AppError } from '../platform/http-errors'
import { bindingRateLimiter } from '../platform/workers-rate-limiter'

// Rafales de mutations /api par IP (T-05c) : remplace la règle de zone de 08-securite.md § 2 tant qu'il n'y a pas
// de domaine (Q24). Limite et période recopiées du binding RATE_LIMITER_MUTATIONS de wrangler.toml.
const MUTATIONS = { name: 'RATE_LIMITER_MUTATIONS', limit: 120, windowSeconds: 60 }
const READS = ['GET', 'HEAD', 'OPTIONS']

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/') || READS.includes(event.method)) return
  const env = event.context.cloudflare?.env as Bindings | undefined
  const decision = await bindingRateLimiter({ RATE_LIMITER_MUTATIONS: env?.RATE_LIMITER_MUTATIONS }).consume(
    MUTATIONS,
    getHeader(event, 'cf-connecting-ip') ?? 'unknown',
  )
  if (!decision.allowed)
    throw new AppError('RATE_LIMITED', 'Too many requests', { retryAfterSeconds: decision.retryAfterSeconds })
})
