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
// visitor, as a member and as a moderator (before the TOTP). Only the authorization is checked: an empty body may still be refused with 400.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const account = (name: string) => ({
  email: `matrix.${name}.${run}@example.com`,
  username: `matrix_${name}_${run}`,
  password: `a long passphrase ${run}`,
})
const cookies = { member: '', staff: '' }

// A valid body where the validation would answer 400 before the use case declares its policy
const BODIES: Record<string, unknown> = {
  'POST /api/auth/mfa/verify': { code: '000000' },
  'POST /api/auth/mfa/challenge': { code: '000000' },
}
const PARAMS: Record<string, string> = { id: '0'.repeat(64), provider: 'google', name: 'Ash', username: 'Ash' }
// The sign-out ends the member's session: last
const routes = Object.entries(ROUTES).sort(([a], [b]) => Number(a.endsWith('signout')) - Number(b.endsWith('signout')))

function call(route: string, as: 'visitor' | keyof typeof cookies) {
  const [method, path] = route.split(' ') as [string, string]
  const url = path.replace(/\[(\w+)\]/g, (_, key: string) => PARAMS[key]!)
  return fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      'sec-fetch-site': 'same-origin',
      'cf-connecting-ip': crypto.randomUUID(),
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      ...(as === 'visitor' ? {} : { cookie: cookies[as] }),
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(BODIES[route] ?? {}) }),
  })
}

beforeAll(async () => {
  const post = (path: string, body: unknown) =>
    fetch(path, {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        'cf-connecting-ip': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    })
  for (const as of ['member', 'staff'] as const) {
    const { email, password, username } = account(as)
    const token = crypto.randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db
      .insert(betaInvites)
      .values({ emailHmac: 'matrix-test', tokenHash, expiresAt: new Date(Date.now() + 3600_000) })
    await post('/api/auth/signup', {
      email,
      password,
      username,
      termsAccepted: true,
      turnstileToken: TURNSTILE_DUMMY_TOKEN,
      inviteToken: token,
    })
    // Verified: posting a capture needs it (US-08.1), the unverified column is checked by tests/api/photos.test.ts
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email))
    if (as === 'staff') await db.update(users).set({ role: 'moderator' }).where(eq(users.email, email))
    const signedIn = await post('/api/auth/signin', { email, password })
    cookies[as] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
    expect(cookies[as]).toMatch(/=/)
  }
})

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'matrix.%@example.com'))
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'matrix-test'))
  await db.$client.end()
})

describe('authorization matrix', () => {
  it.each(routes)('US-55 %s as a visitor: 401 for a member route, open otherwise', async (route, { access }) => {
    const response = await call(route, 'visitor')
    if (access !== 'public') expect((await response.json()).error.code).toBe('UNAUTHENTICATED')
    else expect(response.status).not.toBe(401)
  })

  it.each(routes)('US-55 %s as a member: neither 401 nor 403, but 403 for a staff route', async (route, { access }) => {
    const response = await call(route, 'member')
    if (access === 'staff') expect((await response.json()).error.details).toMatchObject({ reason: 'role' })
    else expect([401, 403]).not.toContain(response.status)
  })

  const staffRoutes = routes.filter(([, { access }]) => access === 'staff')
  it.each(staffRoutes)('US-55.2 %s as a moderator before the TOTP: neither 401 nor 403', async (route) => {
    expect([401, 403]).not.toContain((await call(route, 'staff')).status)
  })
})
