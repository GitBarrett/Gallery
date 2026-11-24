import { createDb } from '../../db/client'
import { notifications } from '../../db/schema'
import { requireContext } from '../../platform/auth-context'
import type { Bindings } from '../../platform/bindings'

// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): gives the signed-in member a Quest log
// for the E2E test of T-23b (US-35.3) before the events that create them (likes, comments…) exist.
export default defineEventHandler(async (event) => {
  const { actor } = await requireContext(event)
  const env = (event.context.cloudflare?.env ?? {}) as Bindings
  const db = createDb(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL!)
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)
  await db.insert(notifications).values([
    { userId: actor.id, type: 'follow', payload: { actorId: actor.id }, createdAt: new Date() },
    { userId: actor.id, type: 'moderation', payload: { outcome: 'rejected' }, createdAt: new Date() },
    { userId: actor.id, type: 'follow', payload: { actorId: actor.id }, createdAt: daysAgo(3), readAt: daysAgo(2) },
  ])
  await db.$client.end()
  return sendNoContent(event)
})
