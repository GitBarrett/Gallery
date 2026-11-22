import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, oauthAccounts, users } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // fakeOAuthProvider: the code is the email typed on the consent page
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more' // seals the cookies
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'api.oauth.%@example.com'))
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'api-oauth-test'))
  await db.$client.end()
})

// features.inviteOnly keeps its launch value (on) in the test database: every new account needs an invitation
async function invite() {
  const token = crypto.randomUUID()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db
    .insert(betaInvites)
    .values({ emailHmac: 'api-oauth-test', tokenHash, expiresAt: new Date(Date.now() + 86_400_000) })
  return token
}

const newEmail = () => `api.oauth.${crypto.randomUUID().slice(0, 8)}@example.com`
const cookieOf = (response: Response, name: string) =>
  response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))
const pair = (header: string | undefined) => header?.split(';')[0] ?? ''
const errorOf = async (response: Response) => ErrorResponse.parse(await response.json()).error

const get = (path: string, cookie = '') => fetch(path, { redirect: 'manual', headers: cookie ? { cookie } : {} })

/** /auth/google: state and cookie of a new flow. */
async function start(query = '') {
  const response = await get(`/auth/google${query}`)
  const location = new URL(response.headers.get('location') ?? '')
  return {
    response,
    location,
    state: location.searchParams.get('state') ?? '',
    cookie: pair(cookieOf(response, '__Host-ls-oauth')),
  }
}

/** Start, consent with `email`, callback: the response of the callback and the flow cookie it leaves. */
async function consent(email: string, query?: string) {
  const flow = await start(query ?? `?invite=${await invite()}`)
  const response = await get(
    `/auth/google/callback?${new URLSearchParams({ state: flow.state, code: email })}`,
    flow.cookie,
  )
  return { response, flow, cookie: pair(cookieOf(response, '__Host-ls-oauth')) }
}

const complete = (cookie: string, username: string) =>
  fetch('/api/auth/oauth/complete', {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      cookie,
      'cf-connecting-ip': crypto.randomUUID(),
    },
    body: JSON.stringify({ username, termsAccepted: true, locale: 'fr' }),
  })

const username = () => `oa_${crypto.randomUUID().slice(0, 8)}`

describe('OAuth Google (fake provider)', () => {
  it('US-02.4 sends to the provider with a random state and an S256 challenge, kept in a short sealed cookie', async () => {
    const { response, location, state, cookie } = await start()
    expect(response.status).toBe(302)
    expect(location.pathname).toBe('/__test/oauth/google')
    expect(state).toMatch(/^[\w-]{43}$/)
    expect(location.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    expect((await start()).state).not.toBe(state)
    const header = cookieOf(response, '__Host-ls-oauth') ?? ''
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Max-Age=1800/)
    expect(cookie).not.toContain(state) // sealed
  })

  it('US-02.4 refuses with 400 a missing, different or replayed state, and opens no session', async () => {
    const flow = await start()
    const email = newEmail()
    const missing = await get(`/auth/google/callback?code=${email}`, flow.cookie)
    const other = await get(`/auth/google/callback?state=forged&code=${email}`, flow.cookie)
    const noCookie = await get(`/auth/google/callback?state=${flow.state}&code=${email}`)
    expect([missing.status, other.status, noCookie.status]).toEqual([400, 400, 400])
    for (const response of [missing, other, noCookie]) {
      expect(cookieOf(response, '__Host-ls-session')).toBeUndefined()
    }
    const used = await consent(email)
    expect(used.response.status).toBe(302)
    const replayed = await get(`/auth/google/callback?state=${used.flow.state}&code=${email}`, used.cookie)
    expect(replayed.status).toBe(400)
  })

  it('US-02.1 asks for a username and the Terms before creating the account, its email verified', async () => {
    const email = newEmail()
    const first = await consent(email)
    expect(first.response.headers.get('location')).toBe('/oauth/complete')
    expect(cookieOf(first.response, '__Host-ls-session')).toBeUndefined()
    expect(await db.select().from(users).where(eq(users.email, email))).toEqual([])
    const pending = await get('/api/auth/oauth/pending', first.cookie)
    expect(await pending.json()).toEqual({ provider: 'google', email, emailTaken: false })

    const name = username()
    const done = await complete(first.cookie, name)
    expect(done.status).toBe(204)
    const session = pair(cookieOf(done, '__Host-ls-session'))
    expect(await (await get('/api/me', session)).json()).toMatchObject({ username: name, emailVerified: true })
    const [created] = await db.select().from(users).where(eq(users.email, email))
    expect(created).toMatchObject({ passwordHash: null, locale: 'fr', termsVersion: expect.any(String) })
    expect(cookieOf(done, '__Host-ls-oauth')).toMatch(/Max-Age=0/)
    expect((await complete(first.cookie, username())).status).toBe(409) // sent twice: one account
  })

  it('US-02.2 signs a linked account in at once', async () => {
    const email = newEmail()
    await complete((await consent(email)).cookie, username())
    const again = await consent(email, '')
    expect(again.response.status).toBe(302)
    expect(again.response.headers.get('location')).toBe('/')
    expect((await get('/api/me', pair(cookieOf(again.response, '__Host-ls-session')))).status).toBe(200)
  })

  it('US-02.3 never merges with the account of the same email: linked after signing in to it', async () => {
    const email = newEmail()
    const password = 'a long passphrase for oauth'
    const signup = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        'cf-connecting-ip': crypto.randomUUID(),
      },
      body: JSON.stringify({
        email,
        username: username(),
        password,
        termsAccepted: true,
        turnstileToken: TURNSTILE_DUMMY_TOKEN,
        inviteToken: await invite(),
      }),
    })
    expect(signup.status).toBe(204)
    const { cookie } = await consent(email.toUpperCase())
    expect(await (await get('/api/auth/oauth/pending', cookie)).json()).toMatchObject({ emailTaken: true })
    const refused = await complete(cookie, username())
    expect(refused.status).toBe(409)
    expect((await errorOf(refused)).details).toEqual({ field: 'email' })

    const signin = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email, password }),
    })
    expect(signin.status).toBe(204)
    const [account] = await db.select().from(users).where(eq(users.email, email))
    expect(await db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, account!.id))).toHaveLength(1)
    expect((await consent(email.toUpperCase(), '')).response.headers.get('location')).toBe('/')
  })

  it('US-02.5 sends a refusal or a provider error back to the sign-in page, in the language of the start', async () => {
    const denied = await start()
    const back = await get(`/auth/google/callback?error=access_denied&state=${denied.state}`, denied.cookie)
    expect(back.headers.get('location')).toBe('/signin?oauth=failed')
    expect(cookieOf(back, '__Host-ls-session')).toBeUndefined()
    const failed = await consent('invalid', '?locale=fr')
    expect(failed.response.headers.get('location')).toBe('/fr/signin?oauth=failed')
  })

  it('answers 404 to the account step without an OAuth sign-in in progress', async () => {
    expect((await complete('', username())).status).toBe(404)
    expect((await get('/api/auth/oauth/pending')).status).toBe(404)
  })
})
