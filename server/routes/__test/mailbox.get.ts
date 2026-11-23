import { mailboxKey } from '../../modules/identity'
import { loadConfig } from '../../platform/config'
import type { Bindings } from '../../platform/bindings'

// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): the last email sent to `?to=` by the fake provider
// (mailboxMailer), so that the E2E opens the verification link; 404 while none arrived.
export default defineEventHandler(async (event) => {
  const to = getQuery(event).to
  const env = (event.context.cloudflare?.env ?? {}) as Bindings
  if (typeof to !== 'string' || !env.R2) throw createError({ statusCode: 404 })
  const stored = await env.R2.get(mailboxKey(loadConfig(process.env).r2Prefix, to))
  if (!stored) throw createError({ statusCode: 404 })
  return JSON.parse(await stored.text()) as unknown
})
