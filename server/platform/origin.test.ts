import { describe, expect, it } from 'vitest'
import { isAllowedRequest } from './origin'

const site = 'https://legendaryshots.example'

describe('isAllowedRequest (CSRF, 08-securite.md § 5)', () => {
  it('always allows reads', () => {
    expect(isAllowedRequest({ method: 'GET' }, site)).toBe(true)
    expect(isAllowedRequest({ method: 'HEAD', origin: 'https://evil.example' }, site)).toBe(true)
  })

  it('allows a mutation from a same-origin page', () => {
    expect(isAllowedRequest({ method: 'POST', secFetchSite: 'same-origin' }, site)).toBe(true)
    expect(isAllowedRequest({ method: 'DELETE', origin: 'https://legendaryshots.example' }, site)).toBe(true)
  })

  it('refuses a mutation from another site', () => {
    expect(isAllowedRequest({ method: 'POST', origin: 'https://evil.example', secFetchSite: 'cross-site' }, site)).toBe(
      false,
    )
  })

  it('refuses a mutation from the same host on another port or scheme', () => {
    expect(isAllowedRequest({ method: 'PUT', origin: 'https://legendaryshots.example:8443' }, site)).toBe(false)
    expect(isAllowedRequest({ method: 'PUT', origin: 'http://legendaryshots.example' }, site)).toBe(false)
  })

  it('refuses a mutation that proves no origin at all', () => {
    expect(isAllowedRequest({ method: 'PATCH' }, site)).toBe(false)
  })
})
