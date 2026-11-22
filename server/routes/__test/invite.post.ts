import { createDb } from '../../db/client'
import { betaInvites } from '../../db/schema'
import type { Bindings } from '../../platform/bindings'

// Preview only (excluded from other builds, nuxt.config.ts): a 14-day beta invitation for the E2E sign-ups,
// until the admin sends them (T-53c). Returns the token of the link /signup?invite=<token>.
export default defineEventHandler(async (event) => {
  const env = (event.context.cloudflare?.env ?? {}) as Bindings
  const db = createDb(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL!)
  const token = crypto.randomUUID()
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  const tokenHash = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  const expiresAt = new Date(Date.now() + 14 * 86_400_000)
  await db.insert(betaInvites).values({ emailHmac: 'e2e', tokenHash, expiresAt })
  await db.$client.end()
  return { token }
})
