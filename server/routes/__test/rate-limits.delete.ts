import { createDb } from '../../db/client'
import { rateLimitCounters } from '../../db/schema'
import type { Bindings } from '../../platform/bindings'

// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): empties the exact counters, so that E2E sign-ups from
// the single CI address (3/h per IP) and the retries of a run do not hit the limits of the previous runs.
export default defineEventHandler(async (event) => {
  const env = (event.context.cloudflare?.env ?? {}) as Bindings
  const db = createDb(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL!)
  await db.delete(rateLimitCounters)
  await db.$client.end()
  return sendNoContent(event)
})
