// Previews and `nuxt dev` only (excluded from other builds, nuxt.config.ts): unexpected error to check Sentry (T-03f)
export default defineEventHandler(() => {
  throw new Error('T-03f: test error for Sentry')
})
