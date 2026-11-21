// R2 host of direct uploads (presigned URLs), known at build time; absent locally until R2 is configured (T-21)
const r2Host = process.env.R2_ACCOUNT_ID ? [`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`] : []

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@nuxt/eslint', 'nuxt-security', '@sentry/nuxt/module', '@nuxt/fonts', '@nuxtjs/storybook'],
  // Design system (ADR-014): tokens then base, loaded everywhere
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],
  // Self-hosted fonts (no call to Google from the browser); global: referenced through var(--font-*)
  fonts: {
    families: [
      { name: 'Inter', weights: [400, 600, 700], global: true },
      { name: 'Cinzel', weights: [700], global: true },
      { name: 'Cinzel Decorative', weights: [700], global: true },
    ],
  },
  typescript: { strict: true },
  devtools: { enabled: false },
  // Default language and title (English, i18n ADR); @nuxtjs/i18n will drive them per page in T-07b
  app: { head: { htmlAttrs: { lang: 'en' }, title: 'Legendary Shots' } },
  // Public values read at startup (NUXT_PUBLIC_SENTRY_DSN, NUXT_PUBLIC_CF_BEACON_TOKEN), empty locally (T-03f)
  runtimeConfig: { public: { sentryDsn: '', cfBeaconToken: '' } },
  // No source map upload (organisation token not needed for the MVP) and no build plugin telemetry
  sentry: { sourcemaps: { disable: true }, telemetry: false },
  // /__test routes (reset, fake mailbox, queue…): only in preview builds (ADR-013)
  nitro: { ignore: process.env.NUXT_DEPLOY_ENV === 'preview' ? [] : ['routes/__test/**'] },
  // Security headers of 08-securite.md § 5
  security: {
    nonce: true,
    rateLimiter: false, // in-memory counters, unsuited to Workers: RateLimiter port in T-05c
    xssValidator: false, // text rendering and strict Zod validation
    corsHandler: false, // no CORS header: the API only serves the site
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
      crossOriginEmbedderPolicy: false, // not required by the spec; would block the Turnstile iframe
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-site',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: { maxAge: 63072000, includeSubdomains: true, preload: true },
      // merged with the module defaults: fullscreen allowed to the site (full-screen photo view)
      permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], fullscreen: ['self'] },
    },
  },
  hooks: {
    // Our handler (common /api error format) runs first; Nuxt's (error page) stays behind it.
    // Declaring `nitro.errorHandler` would replace Nuxt's handler instead of adding ours.
    'nitro:config'(config) {
      config.errorHandler = ['~~/server/error-handler', ...[config.errorHandler ?? []].flat()]
    },
  },
})
