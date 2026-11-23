import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, users } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // Turnstile accepts only the dummy token of its test keys
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more' // seals the session cookie
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'api.names.%@example.com')) // cascades to username_redirects
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'api-names-test'))
  await db.$client.end()
})

const headers = (cookie = '') => ({
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
  'cf-connecting-ip': crypto.randomUUID(),
  ...(cookie ? { cookie } : {}),
})
const errorOf = async (response: Response) => ErrorResponse.parse(await response.json()).error
const name = () => `Nm_${crypto.randomUUID().slice(0, 8)}`

/** A signed-in member: its session cookie and username. */
async function member() {
  const token = crypto.randomUUID()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db
    .insert(betaInvites)
    .values({ emailHmac: 'api-names-test', tokenHash, expiresAt: new Date(Date.now() + 86_400_000) })
  const username = name()
  const email = `api.names.${username.toLowerCase()}@example.com`
  const password = 'a long passphrase for names'
  const body = { email, username, password, termsAccepted: true, turnstileToken: TURNSTILE_DUMMY_TOKEN }
  await fetch('/api/auth/signup', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...body, inviteToken: token }),
  })
  const signin = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  return { cookie: (signin.headers.get('set-cookie') ?? '').split(';')[0]!, username }
}

const rename = (cookie: string, username: string) =>
  fetch('/api/me', { method: 'PATCH', headers: headers(cookie), body: JSON.stringify({ username }) })
const availability = async (username: string) => (await fetch(`/api/usernames/${username}/availability`)).json()

describe('PATCH /api/me', () => {
  it('US-05.1 saves a new username for the signed-in member only', async () => {
    const { cookie } = await member()
    const renamed = name()
    expect((await rename('', renamed)).status).toBe(401)
    const response = await rename(cookie, renamed)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ username: renamed })
    expect(await (await fetch('/api/me', { headers: { cookie } })).json()).toMatchObject({ username: renamed })
  })

  it('US-05.2 refuses a taken or reserved username', async () => {
    const other = await member()
    const { cookie } = await member()
    const taken = await rename(cookie, other.username.toUpperCase())
    expect(taken.status).toBe(409)
    expect((await errorOf(taken)).details).toEqual({ field: 'username' })
    const reserved = await rename(cookie, 'admin')
    expect(reserved.status).toBe(400)
    expect((await errorOf(reserved)).details).toEqual({ field: 'username', reason: 'reserved' })
  })

  it('US-05.4 redirects the former profile to the new one, and refuses a second change within 30 days', async () => {
    const { cookie, username } = await member()
    const renamed = name()
    await rename(cookie, renamed)
    expect(await (await fetch(`/api/users/${username}`)).json()).toMatchObject({ username: renamed })
    const page = await fetch(`/u/${username}`, { redirect: 'manual' })
    expect(page.status).toBe(301)
    expect(page.headers.get('location')).toBe(`/u/${renamed}`)
    expect(await availability(username)).toEqual({ available: false, reason: 'taken' })
    const again = await rename(cookie, name())
    expect(again.status).toBe(429)
    expect((await errorOf(again)).details).toEqual({ retryAfterSeconds: 30 * 86_400 })
  })
})

describe('GET /api/usernames/{name}/availability', () => {
  it('US-05.2 answers for anyone whether a username can be used, and why not', async () => {
    const { username } = await member()
    expect(await availability(username.toLowerCase())).toEqual({ available: false, reason: 'taken' })
    expect(await availability('support')).toEqual({ available: false, reason: 'reserved' })
    expect(await availability(name())).toEqual({ available: true })
  })
})

describe('PATCH /api/me (bio and language)', () => {
  const update = (cookie: string, body: object) =>
    fetch('/api/me', { method: 'PATCH', headers: headers(cookie), body: JSON.stringify(body) })

  it('US-07.1 saves the bio and the language, the profile shows the bio at once', async () => {
    const { cookie, username } = await member()
    expect((await update(cookie, { bio: ' Moonwell watcher. ', locale: 'fr' })).status).toBe(200)
    expect((await (await fetch(`/api/users/${username}`)).json()).bio).toBe('Moonwell watcher.')
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.username, username))
    expect(row?.locale).toBe('fr')
  })

  it('US-07.1 refuses a bio over 300 characters or with an insult, an empty body, and a visitor', async () => {
    const { cookie } = await member()
    const long = await update(cookie, { bio: 'b'.repeat(301) })
    expect(long.status).toBe(400)
    expect((await errorOf(long)).details).toMatchObject({ field: 'bio', reason: 'too_long' })
    expect((await errorOf(await update(cookie, { bio: 'the bastard' }))).details).toMatchObject({ reason: 'insult' })
    expect((await update(cookie, {})).status).toBe(400)
    expect((await update('', { bio: 'Hello' })).status).toBe(401)
  })

  it('US-07.1 answers 403 to the bio of a suspended member, who may still change their language', async () => {
    const { cookie, username } = await member()
    await db.update(users).set({ status: 'suspended' }).where(eq(users.username, username))
    expect((await update(cookie, { bio: 'Hello' })).status).toBe(403)
    expect((await update(cookie, { locale: 'fr' })).status).toBe(200)
  })
})
