import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { gameVersions, outbox, photos, users } from '../../server/db/schema'
import { LikeResponse } from '../../shared/contracts/photos'

// Likes (T-40a) over HTTP and Postgres; the rules and the limit are checked by likes.test.ts.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const ids = { shown: crypto.randomUUID(), hidden: crypto.randomUUID() }
const cookies = { author: '', fan: '' }

beforeAll(async () => {
  const [author] = await db
    .insert(users)
    .values([
      { email: `likes.author.${run}@example.com`, username: `like_a_${run}`, passwordHash: phc(password) },
      // US-08.2: an address never verified may like
      { email: `likes.fan.${run}@example.com`, username: `like_f_${run}`, passwordHash: phc(password) },
    ])
    .returning()
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const capture = { userId: author!.id, mime: 'image/png', bytes: 1, width: 1920, height: 1080 }
  const done = { title: 'Like', gameVersionId: version!.id, uploadedAt: new Date(), publishedAt: new Date() }
  await db.insert(photos).values([
    { ...capture, ...done, id: ids.shown, status: 'published', likesCount: 2 }, // the 3rd like: Uncommon
    { ...capture, ...done, id: ids.hidden, status: 'hidden' },
  ])
  const signin = async (who: keyof typeof cookies) => {
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email: `likes.${who}.${run}@example.com`, password }),
    })
    cookies[who] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
  await signin('author')
  await signin('fan')
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `likes.%.${run}@example.com`)) // captures and likes cascade
  await db.$client.end()
})

const call = (method: 'GET' | 'PUT' | 'DELETE', id: string, cookie = '') =>
  fetch(`/api/photos/${id}/like`, {
    method,
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': run },
  })

describe('PUT / DELETE /api/photos/{id}/like', () => {
  it('US-30.1 US-08.2 US-30.6 likes once, unlikes, and tells the author of the like and the tier reached', async () => {
    const liked = await call('PUT', ids.shown, cookies.fan)
    expect(liked.status).toBe(200)
    expect(LikeResponse.parse(await liked.json())).toEqual({ liked: true, likes: 3 })
    expect(await (await call('PUT', ids.shown, cookies.fan)).json()).toEqual({ liked: true, likes: 3 })
    const [photo] = await db.select().from(photos).where(eq(photos.id, ids.shown))
    expect(photo).toMatchObject({ likesCount: 3, qualityTierNotified: 1 })
    const events = await db
      .select({ type: sql<string>`${outbox.payload}->>'type'` })
      .from(outbox)
      .where(sql`${outbox.payload}->>'photoId' = ${ids.shown}`)
      .orderBy(outbox.createdAt)
    expect(events.map((e) => e.type)).toEqual(['like', 'quality'])
    const state = await call('GET', ids.shown, cookies.fan)
    expect(state.headers.get('cache-control')).toBe('private, no-store')
    expect(await state.json()).toEqual({ liked: true, likes: 3 })
    expect(await (await call('DELETE', ids.shown, cookies.fan)).json()).toEqual({ liked: false, likes: 2 })
    expect((await call('GET', ids.shown)).status).toBe(401)
  })

  it('US-30.2 refuses their own capture (403), a visitor (401), a capture that is not public (404)', async () => {
    expect((await call('PUT', ids.shown, cookies.author)).status).toBe(403)
    expect((await call('PUT', ids.shown)).status).toBe(401)
    expect((await call('DELETE', ids.shown)).status).toBe(401)
    expect((await call('PUT', ids.hidden, cookies.fan)).status).toBe(404)
    expect((await call('PUT', 'not-a-uuid', cookies.fan)).status).toBe(400)
  })
})
