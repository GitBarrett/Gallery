import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { gameVersions, photos, users } from '../../server/db/schema'
import { MyPhotosResponse } from '../../shared/contracts/photos'

// /img (T-25a) and « My captures » (T-25b) over HTTP and Postgres. The Node server's bucket stays empty: the refusals are checked here, the
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
let owner = ''

const get = (path: string, cookie = '') => fetch(path, { headers: { cookie, 'cf-connecting-ip': run } })

beforeAll(async () => {
  const [author] = await db
    .insert(users)
    .values({ email: `images.owner.${run}@example.com`, username: `img_o_${run}`, passwordHash: phc(password) })
    .returning()
  const email = `images.member.${run}@example.com`
  await db.insert(users).values({ email, username: `img_m_${run}`, passwordHash: phc(password) })
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const capture = { userId: author!.id, mime: 'image/png', bytes: 10, width: 1920, height: 1080 }
  const completed = { title: 'Dusk', gameVersionId: version!.id, uploadedAt: new Date() }
  await db.insert(photos).values([
    { ...capture, ...completed, id: ids.published, status: 'published' },
    { ...capture, ...completed, id: ids.review, status: 'pending_review' },
    { ...capture, id: crypto.randomUUID() }, // upload never completed: not listed
  ])
  const signin = async (address: string) => {
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email: address, password }),
    })
    return (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
  member = await signin(email)
  owner = await signin(`images.owner.${run}@example.com`)
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `images.%.${run}@example.com`)) // their captures cascade
  await db.$client.end()
})

describe('POST /api/photos/{id}/download', () => {
  const download = (id: string, cookie = '') =>
    fetch(`/api/photos/${id}/download`, {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': run },
    })

  it('US-23.2 asks a visitor to sign in (401)', async () => {
    expect((await download(ids.published)).status).toBe(401)
  })

  it('US-23.1 finds no capture that is not published, nor one without its original, for its author too', async () => {
    expect((await download(ids.review, owner)).status).toBe(404)
    expect((await download(crypto.randomUUID(), member)).status).toBe(404)
    expect((await download(ids.published, member)).status).toBe(404) // the Node server's bucket is empty
    expect((await download('not-a-uuid', member)).status).toBe(400)
  })
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

describe('GET /api/me/photos', () => {
  it('US-14.4 lists the member’s own completed captures of every status, and nobody else’s', async () => {
    const own = MyPhotosResponse.parse(await (await get('/api/me/photos', owner)).json())
    expect(own.items.map((c) => [c.id, c.status, c.width]).sort()).toEqual(
      [
        [ids.published, 'published', 1920],
        [ids.review, 'pending_review', 1920],
      ].sort(),
    )
    expect(own.nextCursor).toBeNull()
    expect(MyPhotosResponse.parse(await (await get('/api/me/photos', member)).json()).items).toEqual([])
    expect((await get('/api/me/photos')).status).toBe(401)
    expect((await get('/api/me/photos?cursor=nope', owner)).status).toBe(400)
  })
})
