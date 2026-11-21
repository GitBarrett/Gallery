import { sentryCloudflareNitroPlugin } from '@sentry/nuxt/module/plugins'
import { beforeSend, dataCollection } from '../platform/sentry'

// Worker Sentry (T-03f, @sentry/cloudflare). Options read on every request; without a DSN (local, tests), inactive.
export default defineNitroPlugin(
  sentryCloudflareNitroPlugin(() => ({
    dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || undefined,
    environment: process.env.NUXT_DEPLOY_ENV,
    dataCollection,
    tracesSampleRate: 0.1,
    beforeSend,
  })),
)
