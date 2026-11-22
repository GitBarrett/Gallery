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
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more' // seals the session cookie
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
    const again = await post('/api/auth/signup', {
      ...body,
      username: `${body.username}x`,
      inviteToken: await invite(),
    })
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

describe('sessions', () => {
  const sessionCookie = (response: Response) => {
    const cookie = response.headers.get('set-cookie') ?? ''
    return { header: cookie, value: cookie.split(';')[0]! }
  }
  const me = (cookie?: string) => fetch('/api/me', { headers: cookie ? { cookie } : {} })
  const account = async () => {
    const body = await signupBody()
    await post('/api/auth/signup', body)
    return { email: body.email, password: body.password, username: body.username }
  }
  const signin = (
    { email, password, turnstileToken }: { email: string; password: string; turnstileToken?: string },
    cookie?: string,
    ip: string = crypto.randomUUID(),
  ) =>
    fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        'cf-connecting-ip': ip,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ email, password, turnstileToken }),
    })

  it('US-03.1 signs in with a secure, HttpOnly, Lax session cookie of 30 days, then knows the member', async () => {
    const { email, password, username } = await account()
    const response = await signin({ email, password })
    expect(response.status).toBe(204)
    const { header, value } = sessionCookie(response)
    expect(header).toMatch(/^__Host-ls-session=/)
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Path=\//)
    expect(header).toMatch(/Max-Age=2592000/)
    expect(await (await me(value)).json()).toMatchObject({ username, role: 'user', emailVerified: false })
  })

  it('US-03.1 issues a new session id at each sign-in and revokes the previous one', async () => {
    const credentials = await account()
    const first = sessionCookie(await signin(credentials)).value
    const second = sessionCookie(await signin(credentials, first)).value
    expect(second).not.toBe(first)
    expect((await me(first)).status).toBe(401)
    expect((await me(second)).status).toBe(200)
  })

  it('US-03.2 answers the same 401 for a wrong password and an unknown email', async () => {
    const { email } = await account()
    const wrong = await signin({ email, password: 'not the password' })
    const unknown = await signin({ email: `nobody.${email}`, password: 'not the password' })
    expect(wrong.status).toBe(401)
    const wrongError = await errorOf(wrong)
    expect(wrongError).toMatchObject({ code: 'UNAUTHENTICATED', details: { reason: 'invalid_credentials' } })
    expect(unknown.status).toBe(401)
    expect((await errorOf(unknown)).details).toEqual(wrongError.details)
    expect(wrong.headers.get('set-cookie')).toBeNull()
  })

  it('US-03.3 asks for Turnstile after 5 failures on an account, then lets a solved check through', async () => {
    const { email, password } = await account()
    for (let i = 0; i < 5; i++) await signin({ email, password: 'not the password' })
    const required = await signin({ email, password })
    expect(required.status).toBe(400)
    expect((await errorOf(required)).details).toEqual({ field: 'turnstileToken', reason: 'required' })
    expect((await signin({ email, password, turnstileToken: TURNSTILE_DUMMY_TOKEN })).status).toBe(204)
  })

  it('US-03.4 revokes the session on sign-out and deletes the cookie', async () => {
    const session = sessionCookie(await signin(await account())).value
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', cookie: session },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toMatch(/^__Host-ls-session=;.*Max-Age=0/)
    expect((await me(session)).status).toBe(401) // the copied cookie is useless too
  })

  it('US-03.5 refuses with 401 and revokes the session of a banned account', async () => {
    const credentials = await account()
    const session = sessionCookie(await signin(credentials)).value
    await db.update(users).set({ status: 'banned' }).where(eq(users.email, credentials.email))
    expect((await me(session)).status).toBe(401)
    await db.update(users).set({ status: 'active' }).where(eq(users.email, credentials.email))
    expect((await me(session)).status).toBe(401)
  })

  it('US-01.5 resends the verification link to a signed-in member, 3 times an hour, 401 for a visitor', async () => {
    const session = sessionCookie(await signin(await account())).value
    const resend = (cookie?: string) =>
      fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
          'cf-connecting-ip': crypto.randomUUID(),
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({ turnstileToken: TURNSTILE_DUMMY_TOKEN }),
      })
    expect((await resend()).status).toBe(401)
    for (let i = 0; i < 3; i++) expect((await resend(session)).status).toBe(204)
    expect((await resend(session)).status).toBe(429)
  })

  it('answers 401 without session and sets no cookie for a visitor', async () => {
    const response = await me()
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('POST /api/auth/verify-email', () => {
  it('US-01.4 refuses an unknown token with 400', async () => {
    const response = await post('/api/auth/verify-email', { token: 'not-a-real-token' })
    expect((await errorOf(response)).details).toEqual({ field: 'token', reason: 'invalid' })
  })
})
