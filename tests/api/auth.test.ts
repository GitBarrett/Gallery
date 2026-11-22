import { fetch, setup } from '@nuxt/test-utils/e2e'
import { like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // Turnstile accepts only the dummy token of its test keys
await setup({ server: true, browser: false })

afterAll(async () => {
  const db = createDb(process.env.DATABASE_URL!)
  await db.delete(users).where(like(users.email, 'api.%@example.com')) // accounts of this file
  await db.$client.end()
})

const post = (path: string, body: unknown, ip: string = crypto.randomUUID()) =>
  fetch(path, {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  })

const signupBody = () => {
  const run = crypto.randomUUID().slice(0, 8)
  return {
    email: `api.${run}@example.com`,
    username: `api_${run}`,
    password: `a long passphrase ${run}`,
    termsAccepted: true,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
  }
}

const errorOf = async (response: Response) => ErrorResponse.parse(await response.json()).error

describe('POST /api/auth/signup', () => {
  it('US-01.1 creates the account and answers 204', async () => {
    expect((await post('/api/auth/signup', signupBody())).status).toBe(204)
  })

  it('US-01.2 answers the same for an email already used', async () => {
    const body = signupBody()
    await post('/api/auth/signup', body)
    const again = await post('/api/auth/signup', { ...body, username: `${body.username}x` })
    expect(again.status).toBe(204)
  })

  it('US-01.6 refuses a missing or invalid Turnstile token with 400', async () => {
    const { turnstileToken: _, ...missing } = signupBody()
    expect((await errorOf(await post('/api/auth/signup', missing))).code).toBe('VALIDATION_FAILED')
    const invalid = await post('/api/auth/signup', { ...signupBody(), turnstileToken: 'forged' })
    expect(invalid.status).toBe(400)
    expect((await errorOf(invalid)).details).toEqual({ field: 'turnstileToken', reason: 'failed' })
  })

  it('US-01.7 refuses a sign-up whose Terms box is not checked', async () => {
    const response = await post('/api/auth/signup', { ...signupBody(), termsAccepted: false })
    expect(response.status).toBe(400)
  })

  it('US-01.3 refuses a breached password with its reason', async () => {
    const response = await post('/api/auth/signup', { ...signupBody(), password: 'password1234' })
    expect(response.status).toBe(400)
    expect((await errorOf(response)).details).toEqual({ field: 'password', reason: 'breached' })
  })

  it('answers 429 with Retry-After after 3 sign-ups from the same IP within the hour', async () => {
    const ip = crypto.randomUUID() // fresh counters, even when the local database is reused
    for (let i = 0; i < 3; i++) await post('/api/auth/signup', signupBody(), ip)
    const response = await post('/api/auth/signup', signupBody(), ip)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('POST /api/auth/verify-email', () => {
  it('US-01.4 refuses an unknown token with 400', async () => {
    const response = await post('/api/auth/verify-email', { token: 'not-a-real-token' })
    expect((await errorOf(response)).details).toEqual({ field: 'token', reason: 'invalid' })
  })
})
