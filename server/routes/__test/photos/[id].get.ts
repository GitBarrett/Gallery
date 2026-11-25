import { eq } from 'drizzle-orm'
import { createDb } from '../../../db/client'
import { photos } from '../../../db/schema'
import { originalKey, variantKey, VARIANTS } from '../../../modules/media'
import type { Bindings } from '../../../platform/bindings'
import { loadConfig } from '../../../platform/config'

// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): status and measures of a capture and the
// objects written by its processing, for the load test of the real Images binding (US-14.5), before "My captures".
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const env = (event.context.cloudflare?.env ?? {}) as Bindings
  const db = createDb(env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL!)
  const [photo] = await db
    .select({
      status: photos.status,
      width: photos.width,
      height: photos.height,
      lumaBl: photos.lumaBl,
      moderationScore: photos.moderationScore,
    })
    .from(photos)
    .where(eq(photos.id, id))
  await db.$client.end()
  if (!photo) throw createError({ statusCode: 404 })
  const prefix = loadConfig(process.env).r2Prefix
  const keys = [originalKey(id), ...VARIANTS.map((v) => variantKey(id, v.name))]
  const stored = await Promise.all(keys.map(async (key) => ((await env.R2?.head(`${prefix}${key}`)) ? key : null)))
  const trashed = Boolean(await env.R2?.head(`${prefix}trash/${originalKey(id)}`))
  return { ...photo, objects: stored.filter(Boolean), trashed }
})
