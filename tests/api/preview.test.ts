import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { describe, expect, it } from 'vitest'

// Preview build (ADR-013): variables read at build time (/__test routes) and at startup (noindex)
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_DEPLOY_ENV = 'preview'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_PUBLIC_CF_BEACON_TOKEN = 'f'.repeat(32)
await startTestServer('preview')

describe('preview build', () => {
  it('asks search engines not to index the preview', async () => {
    expect((await fetch('/', { headers: { accept: 'text/html' } })).headers.get('x-robots-tag')).toBe(
      'noindex, nofollow',
    )
  })

  it('includes the queue test route (503 here: no queue binding outside Workers)', async () => {
    expect(
      (await fetch('/__test/queue-ping', { method: 'POST', headers: { origin: 'http://localhost:3000' } })).status,
    ).toBe(503)
  })

  it('loads the Web Analytics beacon with the CSP nonce (08-securite.md § 5)', async () => {
    const response = await fetch('/', { headers: { accept: 'text/html' } })
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get('content-security-policy') ?? '')?.[1]
    const html = await response.text()
    const beacon = /<script[^>]*beacon\.min\.js[^>]*>/.exec(html)?.[0]
    expect(nonce).toBeTruthy()
    expect(beacon).toContain(`nonce="${nonce}"`)
    expect(beacon).toContain('f'.repeat(32))
  })

  it('US-69.2 a page error answers 500 with the cf-ray correlation id and no technical detail', async () => {
    const response = await fetch('/__test/page-error', {
      headers: { accept: 'text/html', 'cf-ray': '9a8b7c6d5e4f-CDG' },
    })
    const html = await response.text()
    expect(response.status).toBe(500)
    expect(html).toContain('9a8b7c6d5e4f-CDG')
    expect(html).not.toContain('T-07c: test error')
  })
})
