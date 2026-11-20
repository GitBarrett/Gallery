import { fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await setup({ server: true, browser: false })

describe('HTTP security (08-securite.md § 5)', () => {
  it('sends a nonce-based CSP whose nonce is on every script of the page', async () => {
    const response = await fetch('/', { headers: { accept: 'text/html' } })
    const csp = response.headers.get('content-security-policy') ?? ''
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
    expect(nonce).toBeTruthy()
    expect(csp).toContain("'strict-dynamic'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    const scripts = [...(await response.text()).matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`)
  })

  it('sends the other security headers', async () => {
    const headers = (await fetch('/', { headers: { accept: 'text/html' } })).headers
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(headers.get('cross-origin-resource-policy')).toBe('same-site')
    const permissions = headers.get('permissions-policy') ?? ''
    for (const rule of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'fullscreen=(self)']) {
      expect(permissions).toContain(rule)
    }
    expect(headers.get('strict-transport-security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses a cross-origin mutation with 403 in the common format', async () => {
    const response = await fetch('/api/health', { method: 'POST', headers: { origin: 'https://evil.example' } })
    expect(response.status).toBe(403)
    expect(ErrorResponse.parse(await response.json()).error.code).toBe('FORBIDDEN')
  })

  it('lets a same-origin mutation through to the route', async () => {
    const response = await fetch('/api/health', { method: 'POST', headers: { origin: 'http://localhost:3000' } })
    expect(response.status).not.toBe(403)
  })
})
