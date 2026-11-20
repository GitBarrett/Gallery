import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { ErrorResponse } from '../../shared/contracts/errors'
import { HealthResponse } from '../../shared/contracts/health'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await setup({ server: true, browser: false })

describe('platform API', () => {
  it('GET /api/health answers ok', async () => {
    expect(HealthResponse.parse(await $fetch('/api/health'))).toEqual({ status: 'ok', checks: {} })
  })

  it('an unknown API route answers 404 in the common error format, with the cf-ray correlation id', async () => {
    const response = await fetch('/api/does-not-exist', { headers: { 'cf-ray': '8f1c2d3e4f5a6b7c-CDG' } })
    expect(response.status).toBe(404)
    expect(ErrorResponse.parse(await response.json()).error).toMatchObject({
      code: 'NOT_FOUND',
      correlationId: '8f1c2d3e4f5a6b7c-CDG',
    })
  })

  it('leaves page errors to Nuxt (HTML, not the API format)', async () => {
    const response = await fetch('/page-that-does-not-exist', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('text/html')
  })
})
