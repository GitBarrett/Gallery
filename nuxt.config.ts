export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxt/eslint'],
  typescript: { strict: true },
  devtools: { enabled: false },
  hooks: {
    // Notre gestionnaire (format commun des erreurs /api) passe d'abord ; celui de Nuxt (page d'erreur) reste
    // derrière. Déclarer `nitro.errorHandler` remplacerait celui de Nuxt au lieu de s'y ajouter.
    'nitro:config'(config) {
      config.errorHandler = ['~~/server/error-handler', ...[config.errorHandler ?? []].flat()]
    },
  },
})
