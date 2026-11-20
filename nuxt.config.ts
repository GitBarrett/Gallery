// Hôte R2 des uploads directs (URL présignées), connu au build ; absent en local tant que R2 n'est pas configuré (T-21)
const r2Host = process.env.R2_ACCOUNT_ID ? [`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`] : []

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxt/eslint', 'nuxt-security'],
  typescript: { strict: true },
  devtools: { enabled: false },
  // En-têtes de sécurité de 08-securite.md § 5
  security: {
    nonce: true,
    rateLimiter: false, // compteurs en mémoire, inadaptés à Workers : port RateLimiter en T-05c
    xssValidator: false, // rendu en texte et validation Zod stricte
    corsHandler: false, // aucun en-tête CORS : l'API ne sert que le site
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'nonce-{{nonce}}'",
          "'strict-dynamic'",
          "'wasm-unsafe-eval'",
          'https://challenges.cloudflare.com',
          'https://static.cloudflareinsights.com',
          'https://eu-assets.i.posthog.com',
        ],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': [
          "'self'",
          ...r2Host,
          'https://eu.i.posthog.com',
          'https://cloudflareinsights.com',
          'https://*.ingest.de.sentry.io',
        ],
        'frame-src': ['https://challenges.cloudflare.com'],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'font-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production',
      },
      crossOriginEmbedderPolicy: false, // non exigé par la spec ; bloquerait l'iframe Turnstile
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-site',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: { maxAge: 63072000, includeSubdomains: true, preload: true },
      // fusionné avec les valeurs par défaut du module : plein écran autorisé au site (vue photo plein écran)
      permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], fullscreen: ['self'] },
    },
  },
  hooks: {
    // Notre gestionnaire (format commun des erreurs /api) passe d'abord ; celui de Nuxt (page d'erreur) reste
    // derrière. Déclarer `nitro.errorHandler` remplacerait celui de Nuxt au lieu de s'y ajouter.
    'nitro:config'(config) {
      config.errorHandler = ['~~/server/error-handler', ...[config.errorHandler ?? []].flat()]
    },
  },
})
