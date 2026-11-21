// Preview uniquement (exclue des autres builds, nuxt.config.ts) : erreur inattendue pour vérifier Sentry (T-03f)
export default defineEventHandler(() => {
  throw new Error('T-03f: test error for Sentry')
})
