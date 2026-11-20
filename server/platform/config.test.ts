import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const valid = { NUXT_PUBLIC_SITE_URL: 'https://legendaryshots.example', NUXT_FAKE_PROVIDERS: 'false' }

describe('loadConfig', () => {
  it('returns a typed config from valid variables', () => {
    expect(loadConfig(valid)).toEqual({ siteUrl: 'https://legendaryshots.example', fakeProviders: false })
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
})
