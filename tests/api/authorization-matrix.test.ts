import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, users } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { ROUTES } from '../authorization-matrix'

// Authorization matrix generated from the route inventory (08-securite.md § 4 and annexe B, T-18a): each route as a
// visitor and as a member. Only the authorization is checked: an empty body may still be refused with 400.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const member = { email: `matrix.${run}@example.com`, username: `matrix_${run}`, password: `a long passphrase ${run}` }
let cookie = ''

const PARAMS: Record<string, string> = { id: '0'.repeat(64), provider: 'google', name: 'Ash', username: 'Ash' }
// The sign-out ends the member's session: last
const routes = Object.entries(ROUTES).sort(([a], [b]) => Number(a.endsWith('signout')) - Number(b.endsWith('signout')))

function call(route: string, withCookie: boolean) {
  const [method, path] = route.split(' ') as [string, string]
  const url = path.replace(/\[(\w+)\]/g, (_, key: string) => PARAMS[key]!)
  return fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      'sec-fetch-site': 'same-origin',
      'cf-connecting-ip': crypto.randomUUID(),
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      ...(withCookie ? { cookie } : {}),
    },
    ...(method === 'GET' ? {} : { body: '{}' }),
  })
}

beforeAll(async () => {
  const token = crypto.randomUUID()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db
    .insert(betaInvites)
    .values({ emailHmac: 'matrix-test', tokenHash, expiresAt: new Date(Date.now() + 3600_000) })
  const post = (path: string, body: unknown) =>
    fetch(path, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  await post('/api/auth/signup', {
    ...member,
    termsAccepted: true,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
    inviteToken: token,
  })
  const signedIn = await post('/api/auth/signin', { email: member.email, password: member.password })
  cookie = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  expect(cookie).toMatch(/=/)
})

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'matrix.%@example.com'))
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'matrix-test'))
  await db.$client.end()
})

describe('authorization matrix', () => {
  it.each(routes)('US-55 %s as a visitor: 401 for a member route, open otherwise', async (route, { access }) => {
    const response = await call(route, false)
    if (access === 'member') expect((await response.json()).error.code).toBe('UNAUTHENTICATED')
    else expect(response.status).not.toBe(401)
  })

  it.each(routes)('US-55 %s as a member: neither 401 nor 403', async (route) => {
    const response = await call(route, true)
    expect([401, 403]).not.toContain(response.status)
  })
})
