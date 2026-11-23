import { z } from 'zod'

// Variables validated at startup; each task adds its own (03-architecture.md § Configuration et secrets).
const schema = z
  .object({
    NUXT_PUBLIC_SITE_URL: z.url(),
    NUXT_FAKE_PROVIDERS: z.enum(['true', 'false']).default('false'),
    NUXT_DEPLOY_ENV: z.enum(['local', 'preview', 'production']).default('local'),
    // R2 object prefix of a preview in the shared ls-preview bucket (ADR-013); empty in production
    NUXT_R2_PREFIX: z
      .string()
      .regex(/^(pr-\d+\/)?$/)
      .default(''),
    // Public values read by Nuxt (runtimeConfig.public) and by the Sentry plugin; empty locally (T-03f)
    NUXT_PUBLIC_SENTRY_DSN: z.union([z.url(), z.literal('')]).optional(),
    NUXT_PUBLIC_CF_BEACON_TOKEN: z
      .string()
      .regex(/^([0-9a-f]{32})?$/)
      .optional(),
    NUXT_PUBLIC_POSTHOG_KEY: z
      .string()
      .regex(/^(phc_\w+)?$/)
      .optional(),
    // Secrets of the real providers, unused with fake providers. Optional at startup so that a missing one only
    // breaks its feature (Q42): the code that needs it fails without it.
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    IP_HASH_KEY_CURRENT: z.string().min(32).optional(),
    NUXT_OAUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    NUXT_OAUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    NUXT_OAUTH_BATTLEDOTNET_CLIENT_ID: z.string().min(1).optional(),
    NUXT_OAUTH_BATTLEDOTNET_CLIENT_SECRET: z.string().min(1).optional(),
    // Consent page of the fake OAuth providers: a test route, only on previews and in tests (ADR-013)
    NUXT_FAKE_OAUTH_CONSENT_URL: z.url().optional(),
  })
  .refine((env) => !(env.NUXT_DEPLOY_ENV === 'production' && env.NUXT_FAKE_PROVIDERS === 'true'), {
    path: ['NUXT_FAKE_PROVIDERS'],
    message: 'fake providers are forbidden in production',
  })

export interface Config {
  siteUrl: string
  fakeProviders: boolean
  deployEnv: 'local' | 'preview' | 'production'
  r2Prefix: string
  turnstileSecret?: string
  resendApiKey?: string
  ipHashKey?: string
  googleClientId?: string
  googleClientSecret?: string
  battlenetClientId?: string
  battlenetClientSecret?: string
  fakeOAuthConsentUrl?: string
}

/** Validates the environment; a missing or invalid variable fails the startup, without printing its value. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
    throw new Error(`Invalid or missing configuration: ${names.join(', ')}`)
  }
  return {
    siteUrl: parsed.data.NUXT_PUBLIC_SITE_URL,
    fakeProviders: parsed.data.NUXT_FAKE_PROVIDERS === 'true',
    deployEnv: parsed.data.NUXT_DEPLOY_ENV,
    r2Prefix: parsed.data.NUXT_R2_PREFIX,
    turnstileSecret: parsed.data.TURNSTILE_SECRET_KEY,
    resendApiKey: parsed.data.RESEND_API_KEY,
    ipHashKey: parsed.data.IP_HASH_KEY_CURRENT,
    googleClientId: parsed.data.NUXT_OAUTH_GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.data.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
    battlenetClientId: parsed.data.NUXT_OAUTH_BATTLEDOTNET_CLIENT_ID,
    battlenetClientSecret: parsed.data.NUXT_OAUTH_BATTLEDOTNET_CLIENT_SECRET,
    fakeOAuthConsentUrl: parsed.data.NUXT_FAKE_OAUTH_CONSENT_URL,
  }
}
