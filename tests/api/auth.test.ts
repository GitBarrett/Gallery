import { fetch, setup } from '@nuxt/test-utils/e2e'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, users, waitlistEntries } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // Turnstile accepts only the dummy token of its test keys
await setup({ server: true, browser: false })

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  // rows of this file; features.inviteOnly keeps its launch value (on) in the test database
  await db.delete(users).where(like(users.email, 'api.%@example.com'))
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'api-test'))
  await db.delete(waitlistEntries).where(like(waitlistEntries.email, 'api.%@example.com'))
  await db.$client.end()
})

/** Token of a fresh invitation (the admin screens that send them come with T-53c). */
async function invite(expiresAt = new Date(Date.now() + 14 * 86_400_000)) {
  const token = crypto.randomUUID()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.insert(betaInvites).values({ emailHmac: 'api-test', tokenHash, expiresAt })
  return token
}

const post = (path: string, body: unknown, ip: string = crypto.randomUUID()) =>
  fetch(path, {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  })

const signupBody = async () => {
  const run = crypto.randomUUID().slice(0, 8)
  return {
    email: `api.${run}@example.com`,
    username: `api_${run}`,
    password: `a long passphrase ${run}`,
    termsAccepted: true,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
    inviteToken: await invite(),
  }
}

const errorOf = async (response: Response) => ErrorResponse.parse(await response.json()).error

describe('POST /api/auth/signup', () => {
  it('US-01.1 creates the account and answers 204', async () => {
    expect((await post('/api/auth/signup', await signupBody())).status).toBe(204)
  })

  it('US-01.2 answers the same for an email already used', async () => {
    const body = await signupBody()
    await post('/api/auth/signup', body)
    const again = await post('/api/auth/signup', { ...body, username: `${body.username}x` })
    expect(again.status).toBe(204)
  })

  it('US-01.6 refuses a missing or invalid Turnstile token with 400', async () => {
    const { turnstileToken: _, ...missing } = await signupBody()
    expect((await errorOf(await post('/api/auth/signup', missing))).code).toBe('VALIDATION_FAILED')
    const invalid = await post('/api/auth/signup', { ...(await signupBody()), turnstileToken: 'forged' })
    expect(invalid.status).toBe(400)
    expect((await errorOf(invalid)).details).toEqual({ field: 'turnstileToken', reason: 'failed' })
  })

  it('US-01.7 refuses a sign-up whose Terms box is not checked', async () => {
    const response = await post('/api/auth/signup', { ...(await signupBody()), termsAccepted: false })
    expect(response.status).toBe(400)
  })

  it('US-01.3 refuses a breached password with its reason', async () => {
    const response = await post('/api/auth/signup', { ...(await signupBody()), password: 'password1234' })
    expect(response.status).toBe(400)
    expect((await errorOf(response)).details).toEqual({ field: 'password', reason: 'breached' })
  })

  it('answers 429 with Retry-After after 3 sign-ups from the same IP within the hour', async () => {
    const ip = crypto.randomUUID() // fresh counters, even when the local database is reused
    for (let i = 0; i < 3; i++) await post('/api/auth/signup', await signupBody(), ip)
    const response = await post('/api/auth/signup', await signupBody(), ip)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('invite-only beta', () => {
  const inviteRequired = async (response: Response) => {
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toMatchObject({ code: 'FORBIDDEN', details: { reason: 'invite_required' } })
  }

  it('US-56.4 refuses a sign-up without a valid invitation, the same way for a new or a used email', async () => {
    const used = await signupBody()
    await post('/api/auth/signup', used)
    const { inviteToken: _, ...uninvited } = await signupBody()
    await inviteRequired(await post('/api/auth/signup', uninvited))
    await inviteRequired(await post('/api/auth/signup', { ...uninvited, email: used.email }))
    const expired = await invite(new Date(Date.now() - 1000))
    await inviteRequired(await post('/api/auth/signup', { ...uninvited, inviteToken: expired }))
    await inviteRequired(await post('/api/auth/signup', { ...uninvited, inviteToken: used.inviteToken }))
  })

  it('US-56.4 puts an email on the waiting list with 204, the same when it already is', async () => {
    const email = `api.${crypto.randomUUID().slice(0, 8)}@example.com`
    const body = { email, locale: 'fr', turnstileToken: TURNSTILE_DUMMY_TOKEN }
    expect((await post('/api/waitlist', body)).status).toBe(204)
    expect((await post('/api/waitlist', { ...body, email: email.toUpperCase() })).status).toBe(204)
    const rows = await db.select().from(waitlistEntries).where(eq(waitlistEntries.email, email))
    expect(rows).toMatchObject([{ email, locale: 'fr' }])
  })

  it('answers 429 after 3 waiting list requests from the same IP within the hour', async () => {
    const ip = crypto.randomUUID()
    const body = () => ({
      email: `api.${crypto.randomUUID().slice(0, 8)}@example.com`,
      turnstileToken: TURNSTILE_DUMMY_TOKEN,
    })
    for (let i = 0; i < 3; i++) await post('/api/waitlist', body(), ip)
    expect((await post('/api/waitlist', body(), ip)).status).toBe(429)
  })
})

describe('POST /api/auth/verify-email', () => {
  it('US-01.4 refuses an unknown token with 400', async () => {
    const response = await post('/api/auth/verify-email', { token: 'not-a-real-token' })
    expect((await errorOf(response)).details).toEqual({ field: 'token', reason: 'invalid' })
  })
})
