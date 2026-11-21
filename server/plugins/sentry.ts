import { sentryCloudflareNitroPlugin } from '@sentry/nuxt/module/plugins'
import { beforeSend, dataCollection } from '../platform/sentry'

// Sentry côté Worker (T-03f, @sentry/cloudflare). Options lues à chaque requête ; sans DSN (local, tests), inactif.
export default defineNitroPlugin(
  sentryCloudflareNitroPlugin(() => ({
    dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || undefined,
    environment: process.env.NUXT_DEPLOY_ENV,
    dataCollection,
    tracesSampleRate: 0.1,
    beforeSend,
  })),
)
