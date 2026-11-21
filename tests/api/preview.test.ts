import { fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

// Build de preview (ADR-013) : variables lues au build (routes /__test) et au démarrage (noindex)
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_DEPLOY_ENV = 'preview'
process.env.NUXT_FAKE_PROVIDERS = 'true'
await setup({ server: true, browser: false })

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
})
