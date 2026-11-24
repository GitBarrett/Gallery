import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, emailTokens, oauthAccounts, users, waitlistEntries } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { SessionsResponse } from '../../shared/contracts/auth'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // Turnstile accepts only the dummy token of its test keys
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more' // seals the session cookie
await startTestServer()

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

  const devices = (cookie?: string) => fetch('/api/me/sessions', { headers: cookie ? { cookie } : {} })
  const revoke = (id: string, cookie?: string) =>
    fetch(`/api/me/sessions/${id}`, {
      method: 'DELETE',
      headers: { 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
    })
  const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'
  const signinFrom = async (credentials: { email: string; password: string }, userAgent: string) =>
    sessionCookie(
      await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
          'cf-connecting-ip': crypto.randomUUID(),
          'user-agent': userAgent,
        },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }),
    ).value

  it('US-03.7 lists the active sessions of the member with a readable device, the current one marked', async () => {
    const credentials = await account()
    const laptop = await signinFrom(credentials, firefox)
    const phone = sessionCookie(await signin(credentials)).value
    await fetch('/api/auth/signout', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin', cookie: phone } })
    const current = sessionCookie(await signin(credentials)).value
    const response = await devices(current)
    expect(response.status).toBe(200)
    const { sessions } = SessionsResponse.parse(await response.json())
    expect(sessions).toHaveLength(2)
    expect(sessions.filter((s) => s.current)).toHaveLength(1)
    expect(sessions.find((s) => !s.current)?.device).toEqual({ browser: 'Firefox', os: 'Linux' })
    expect((await devices(laptop)).status).toBe(200)
    expect((await devices()).status).toBe(401)
  })

  it("US-03.8 revokes one of the member's sessions; another member's or an unknown one answers 404", async () => {
    const credentials = await account()
    const laptop = await signinFrom(credentials, firefox)
    const current = sessionCookie(await signin(credentials)).value
    const other = sessionCookie(await signin(await account())).value
    const idOf = async (cookie: string) =>
      SessionsResponse.parse(await (await devices(cookie)).json()).sessions.find((s) => s.current)!.id

    expect((await revoke(await idOf(other), current)).status).toBe(404)
    expect((await me(other)).status).toBe(200)
    expect((await revoke('0'.repeat(64), current)).status).toBe(404)
    expect((await revoke('not-an-id', current)).status).toBe(400)
    expect((await revoke(await idOf(laptop))).status).toBe(401)
    expect((await revoke(await idOf(laptop), current)).status).toBe(204)
    expect((await me(laptop)).status).toBe(401)
    expect((await me(current)).status).toBe(200)
  })

  it('US-03.9 revokes every other session of the member and keeps the current one', async () => {
    const credentials = await account()
    const laptop = sessionCookie(await signin(credentials)).value
    const current = sessionCookie(await signin(credentials)).value
    const other = sessionCookie(await signin(await account())).value
    const revokeOthers = (cookie?: string) =>
      fetch('/api/me/sessions/revoke-others', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
      })
    expect((await revokeOthers()).status).toBe(401)
    expect((await revokeOthers(current)).status).toBe(204)
    expect((await me(laptop)).status).toBe(401)
    expect((await me(current)).status).toBe(200)
    expect((await me(other)).status).toBe(200)
  })

  // Reset link of the account, as the `emails` consumer would mail it (the screens and E2E come with T-13b)
  const resetToken = async (email: string, expiresAt = new Date(Date.now() + 3600_000)) => {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    const token = crypto.randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db.insert(emailTokens).values({ userId: user!.id, type: 'reset', tokenHash, expiresAt })
    return token
  }
  const reset = (body: { token: string; password: string }, cookie?: string) =>
    fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })

  it('US-04.1 answers 204 to a reset request, the same for an unknown email; 400 without Turnstile', async () => {
    const { email } = await account()
    const forgot = (body: object) => post('/api/auth/password/forgot', body)
    expect((await forgot({ email, turnstileToken: TURNSTILE_DUMMY_TOKEN })).status).toBe(204)
    expect((await forgot({ email: 'api.nobody@example.com', turnstileToken: TURNSTILE_DUMMY_TOKEN })).status).toBe(204)
    expect((await errorOf(await forgot({ email, turnstileToken: 'bot' }))).details).toEqual({
      field: 'turnstileToken',
      reason: 'failed',
    })
  })

  it('US-04.4 answers 204 to requests over the limits of an email and an IP', async () => {
    const { email } = await account()
    const ip = crypto.randomUUID()
    for (let i = 0; i < 12; i++) {
      const response = await post('/api/auth/password/forgot', { email, turnstileToken: TURNSTILE_DUMMY_TOKEN }, ip)
      expect(response.status).toBe(204)
    }
  })

  it('US-04.3 sets the new password, ends every session of the account, then signs it in', async () => {
    const credentials = await account()
    const laptop = sessionCookie(await signin(credentials)).value
    const current = sessionCookie(await signin(credentials)).value
    const password = 'a brand new passphrase'
    const response = await reset({ token: await resetToken(credentials.email), password }, current)
    expect(response.status).toBe(204)
    const signedIn = sessionCookie(response).value
    expect((await me(laptop)).status).toBe(401)
    expect((await me(current)).status).toBe(401)
    expect((await me(signedIn)).status).toBe(200)
    expect((await signin(credentials)).status).toBe(401)
    expect((await signin({ email: credentials.email, password })).status).toBe(204)
  })

  it('US-04.5 cancels the other reset links of the account and marks its email verified', async () => {
    const { email } = await account()
    const [first, second] = [await resetToken(email), await resetToken(email)]
    const response = await reset({ token: first, password: 'a brand new passphrase' })
    expect((await me(sessionCookie(response).value).then((r) => r.json())).emailVerified).toBe(true)
    const other = await reset({ token: second, password: 'another new passphrase' })
    expect((await errorOf(other)).details).toEqual({ field: 'token', reason: 'invalid' })
  })

  it('US-04.2 refuses a reset link already used or expired, with 400 and its reason', async () => {
    const { email } = await account()
    const token = await resetToken(email)
    expect((await reset({ token, password: 'a brand new passphrase' })).status).toBe(204)
    const used = await reset({ token, password: 'another new passphrase' })
    expect((await errorOf(used)).details).toEqual({ field: 'token', reason: 'invalid' })
    const expired = await reset({
      token: await resetToken(email, new Date(Date.now() - 1000)),
      password: 'another new passphrase',
    })
    expect((await errorOf(expired)).details).toEqual({ field: 'token', reason: 'expired' })
  })

  it('US-82.1 US-82.2 US-82.3 saves the social networks, reads them back and shows them on the profile', async () => {
    const credentials = await account()
    const cookie = sessionCookie(await signin(credentials)).value
    const put = (links: unknown, withCookie = true) =>
      fetch('/api/me/social-links', {
        method: 'PUT',
        headers: {
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
          ...(withCookie ? { cookie } : {}),
        },
        body: JSON.stringify({ links }),
      })
    const links = [
      { platform: 'twitch', handle: 'luneblade' },
      { platform: 'website', handle: 'https://ash.example.com/shots' },
    ]
    expect((await put(links, false)).status).toBe(401)
    expect((await errorOf(await put([{ platform: 'twitch', handle: 'twitch.tv/x' }]))).details).toEqual({
      field: 'twitch',
      reason: 'format',
    })
    expect((await put([links[0], links[0]])).status).toBe(400) // one identifier per network
    expect((await put(links)).status).toBe(204)
    const own = await fetch('/api/me/social-links', { headers: { cookie } })
    expect(await own.json()).toEqual({ links }) // kept in the settings while the profile hides them (US-82.5)
    await db
      .update(users)
      .set({ createdAt: new Date('2026-11-01T10:00:00Z') })
      .where(eq(users.email, credentials.email))
    const profile = await (await fetch(`/api/users/${credentials.username}`)).json()
    expect(profile.socialLinks).toEqual([
      { platform: 'twitch', label: 'luneblade', url: 'https://twitch.tv/luneblade' },
      { platform: 'website', label: 'ash.example.com', url: 'https://ash.example.com/shots' },
    ])
  })

  it('US-07.2 changes the email with the current password, once its link is opened', async () => {
    const credentials = await account()
    const cookie = sessionCookie(await signin(credentials)).value
    const change = (body: unknown, withCookie = true) =>
      fetch('/api/me/email', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
          ...(withCookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      })
    const newEmail = `new.${credentials.email}`
    expect((await change({ newEmail }, false)).status).toBe(401)
    const wrong = await change({ newEmail, currentPassword: 'not the password' })
    expect((await errorOf(wrong)).details).toEqual({ field: 'currentPassword', reason: 'wrong' })
    expect((await change({ newEmail, currentPassword: credentials.password })).status).toBe(204)
    const own = await fetch('/api/me/account', { headers: { cookie } })
    expect(await own.json()).toMatchObject({ email: credentials.email, hasPassword: true, providers: [] }) // unchanged until confirmed

    // The link the `emails` consumer would mail to the new address
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, credentials.email))
    const token = crypto.randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 3600_000)
    await db.insert(emailTokens).values({ userId: user!.id, type: 'email_change', tokenHash, newEmail, expiresAt })
    const confirm = () => post('/api/auth/email/confirm', { token })
    expect((await confirm()).status).toBe(204)
    expect((await errorOf(await confirm())).details).toEqual({ field: 'token', reason: 'invalid' })
    expect((await signin({ email: newEmail, password: credentials.password })).status).toBe(204)
    expect((await signin(credentials)).status).toBe(401)
  })

  it('US-07.4 lists and unlinks a provider, refused when it is the last way to sign in', async () => {
    const credentials = await account()
    const cookie = sessionCookie(await signin(credentials)).value
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, credentials.email))
    await db.insert(oauthAccounts).values([
      { userId: user!.id, provider: 'google', providerUserId: `google-${user!.id}` },
      { userId: user!.id, provider: 'battlenet', providerUserId: `battlenet-${user!.id}` },
    ])
    const unlink = (provider: string, withCookie = true) =>
      fetch(`/api/me/oauth/${provider}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin', ...(withCookie ? { cookie } : {}) },
      })
    expect((await unlink('google', false)).status).toBe(401)
    expect((await unlink('github')).status).toBe(400)
    expect((await (await fetch('/api/me/account', { headers: { cookie } })).json()).providers).toEqual([
      'google',
      'battlenet',
    ])
    expect((await unlink('google')).status).toBe(204)
    expect((await unlink('google')).status).toBe(404)
    // Without a password, Battle.net is now the only way to sign in
    await db.update(users).set({ passwordHash: null }).where(eq(users.id, user!.id))
    const refused = await unlink('battlenet')
    expect(refused.status).toBe(403)
    expect((await errorOf(refused)).details).toEqual({ reason: 'last_sign_in_method' })
  })

  it('US-07.3 changes the password with the old one and revokes the other sessions only', async () => {
    const credentials = await account()
    const laptop = sessionCookie(await signin(credentials)).value
    const current = sessionCookie(await signin(credentials)).value
    const change = (body: { currentPassword: string; password: string }, cookie?: string) =>
      fetch('/api/me/password', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      })
    const password = 'a brand new passphrase'
    expect((await change({ currentPassword: credentials.password, password })).status).toBe(401)
    const wrong = await change({ currentPassword: 'not the password', password }, current)
    expect((await errorOf(wrong)).details).toEqual({ field: 'currentPassword', reason: 'wrong' })
    expect((await me(laptop)).status).toBe(200)
    expect((await change({ currentPassword: credentials.password, password }, current)).status).toBe(204)
    expect((await me(laptop)).status).toBe(401)
    expect((await me(current)).status).toBe(200)
    expect((await signin({ email: credentials.email, password })).status).toBe(204)
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
