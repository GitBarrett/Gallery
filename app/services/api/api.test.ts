import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { HealthResponse } from '../../../shared/contracts/health'
import { api, ApiError, call, errorMessageKey } from './index'

// /api/health fails once in the common error format, then answers
let healthCalls = 0
registerEndpoint('/api/health', () => {
  if (++healthCalls > 1) return { status: 'ok', checks: {} }
  const body = { error: { code: 'RATE_LIMITED', message: 'technical', correlationId: '8f1c-CDG' } }
  return new Response(JSON.stringify(body), { status: 429, headers: { 'content-type': 'application/json' } })
})
registerEndpoint('/api/health-broken', () => ({ unexpected: true }))

const [en, fr] = ['en', 'fr'].map((locale) => JSON.parse(readFileSync(`i18n/${locale}.json`, 'utf8')))
const message = (messages: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages)

describe('API client', () => {
  it('US-69.3 an API error becomes an ApiError with its code and correlation id, translated in EN and FR', async () => {
    healthCalls = 0
    const error = await api.health().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, correlationId: '8f1c-CDG' })
    const key = errorMessageKey(error)
    expect(message(en, key)).toEqual(expect.any(String))
    expect(message(fr, key)).toEqual(expect.any(String))
    expect(message(en, key)).not.toBe('technical')
  })

  it('US-69.3 the same call can be retried and then succeeds', async () => {
    healthCalls = 0
    await expect(api.health()).rejects.toBeInstanceOf(ApiError)
    await expect(api.health()).resolves.toEqual({ status: 'ok', checks: {} })
  })

  it('treats a response outside the contract and an unknown failure as an internal error', async () => {
    await expect(call('/api/health-broken', HealthResponse)).rejects.toMatchObject({
      code: 'INTERNAL',
    })
    expect(errorMessageKey(new Error('network down'))).toBe('errors.INTERNAL')
  })
})
