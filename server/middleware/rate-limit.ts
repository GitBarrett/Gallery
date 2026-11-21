import type { Bindings } from '../platform/bindings'
import { AppError } from '../platform/http-errors'
import { bindingRateLimiter } from '../platform/workers-rate-limiter'

// Bursts of /api mutations per IP (T-05c): replaces the zone rule of 08-securite.md § 2 as long as there is no
// domain (Q24). Limit and period copied from the RATE_LIMITER_MUTATIONS binding of wrangler.toml.
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
