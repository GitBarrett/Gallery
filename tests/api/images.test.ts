import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { photos, users } from '../../server/db/schema'

// /img over HTTP and Postgres (T-25a). The Node server's bucket stays empty: the refusals are checked here, the
// images served by tests/e2e/moderation.spec.ts on the preview (real R2), the rules by serve-image.test.ts.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const ids = { published: crypto.randomUUID(), review: crypto.randomUUID() }
let member = ''

const get = (path: string, cookie = '') => fetch(path, { headers: { cookie, 'cf-connecting-ip': run } })

beforeAll(async () => {
  const [owner] = await db
    .insert(users)
    .values({ email: `images.owner.${run}@example.com`, username: `img_o_${run}`, passwordHash: phc(password) })
    .returning()
  const email = `images.member.${run}@example.com`
  await db.insert(users).values({ email, username: `img_m_${run}`, passwordHash: phc(password) })
  const capture = { userId: owner!.id, mime: 'image/png', bytes: 10, width: 1920, height: 1080 }
  await db.insert(photos).values([
    { ...capture, id: ids.published, status: 'published' },
    { ...capture, id: ids.review, status: 'pending_review' },
  ])
  const signedIn = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
    body: JSON.stringify({ email, password }),
  })
  member = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `images.%.${run}@example.com`)) // their captures cascade
  await db.$client.end()
})

describe('GET /img/{id}/{size}', () => {
  it.each(['640', '1200.jpg', 'original'])('US-68.3 answers 404, not stored, for the size « %s »', async (size) => {
    const response = await get(`/img/${ids.published}/${size}`)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 404 for an id that is not a capture', async () => {
    expect((await get('/img/not-a-uuid/800')).status).toBe(404)
    expect((await get(`/img/${crypto.randomUUID()}/800`)).status).toBe(404)
  })

  it('US-14.4 hides an unpublished capture from a visitor and another member, preview or not', async () => {
    expect((await get(`/img/${ids.review}/800`)).status).toBe(404)
    expect((await get(`/img/${ids.review}/800?preview=1`)).status).toBe(404)
    expect((await get(`/img/${ids.review}/800?preview=1`, member)).status).toBe(404)
  })
})
