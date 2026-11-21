import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const valid = { NUXT_PUBLIC_SITE_URL: 'https://legendaryshots.example', NUXT_FAKE_PROVIDERS: 'false' }

describe('loadConfig', () => {
  it('returns a typed config from valid variables', () => {
    expect(loadConfig(valid)).toEqual({
      siteUrl: 'https://legendaryshots.example',
      fakeProviders: false,
      deployEnv: 'local',
      r2Prefix: '',
    })
  })

  it('fails at startup when a required variable is missing, naming it', () => {
    expect(() => loadConfig({ NUXT_FAKE_PROVIDERS: 'true' })).toThrow(/NUXT_PUBLIC_SITE_URL/)
  })

  it('never echoes the invalid value, which may be a secret', () => {
    expect(() => loadConfig({ ...valid, NUXT_PUBLIC_SITE_URL: 'not-a-url-s3cr3t' })).toThrow(/^(?!.*s3cr3t)/s)
  })

  it('rejects anything but true or false for the fake providers flag', () => {
    expect(() => loadConfig({ ...valid, NUXT_FAKE_PROVIDERS: 'yes' })).toThrow(/NUXT_FAKE_PROVIDERS/)
  })

  it('refuses to start in production with the fake providers', () => {
    expect(() => loadConfig({ ...valid, NUXT_DEPLOY_ENV: 'production', NUXT_FAKE_PROVIDERS: 'true' })).toThrow(
      /NUXT_FAKE_PROVIDERS/,
    )
    expect(loadConfig({ ...valid, NUXT_DEPLOY_ENV: 'preview', NUXT_FAKE_PROVIDERS: 'true' }).fakeProviders).toBe(true)
  })

  it('accepts only an empty R2 prefix or the pr-{n}/ prefix of a preview', () => {
    expect(loadConfig({ ...valid, NUXT_R2_PREFIX: 'pr-42/' }).r2Prefix).toBe('pr-42/')
    expect(() => loadConfig({ ...valid, NUXT_R2_PREFIX: '../originals/' })).toThrow(/NUXT_R2_PREFIX/)
  })

  it('accepts an absent or valid Sentry DSN and Web Analytics token, and rejects anything else', () => {
    const ok = {
      ...valid,
      NUXT_PUBLIC_SENTRY_DSN: 'https://abc@o1.ingest.de.sentry.io/2',
      NUXT_PUBLIC_CF_BEACON_TOKEN: 'f'.repeat(32),
    }
    expect(() => loadConfig(ok)).not.toThrow()
    expect(() => loadConfig({ ...valid, NUXT_PUBLIC_SENTRY_DSN: '', NUXT_PUBLIC_CF_BEACON_TOKEN: '' })).not.toThrow()
    expect(() => loadConfig({ ...ok, NUXT_PUBLIC_SENTRY_DSN: 'not a url' })).toThrow(/NUXT_PUBLIC_SENTRY_DSN/)
    expect(() => loadConfig({ ...ok, NUXT_PUBLIC_CF_BEACON_TOKEN: '<script>' })).toThrow(/NUXT_PUBLIC_CF_BEACON_TOKEN/)
  })
})
