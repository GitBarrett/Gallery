import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { outbox, photos, users } from '../../server/db/schema'
import { ErrorResponse } from '../../shared/contracts/errors'
import { CompleteUploadResponse, UploadUrlResponse } from '../../shared/contracts/photos'

// Upload over HTTP and Postgres (T-21). The Node server has no R2 binding: its bucket is in memory and stays empty,
// so `complete` finds no object; the PUT to the real bucket is exercised by tests/e2e/upload.spec.ts.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const cookies = { verified: '', unverified: '', other: '', busy: '' }
const file = { contentType: 'image/png', bytes: 5_000_000, width: 1920, height: 1080 }

const post = (path: string, body: unknown, as?: keyof typeof cookies) =>
  fetch(path, {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'cf-connecting-ip': crypto.randomUUID(),
      ...(as ? { cookie: cookies[as] } : {}),
    },
    body: JSON.stringify(body),
  })
const codeOf = async (response: Response) => ErrorResponse.parse(await response.json()).error

beforeAll(async () => {
  const passwordHash = phc(password)
  for (const as of Object.keys(cookies) as (keyof typeof cookies)[]) {
    const email = `photos.${as}.${run}@example.com`
    await db.insert(users).values({
      email,
      username: `photos_${as.slice(0, 5)}_${run}`,
      passwordHash,
      emailVerifiedAt: as === 'unverified' ? null : new Date(),
    })
    const signedIn = await post('/api/auth/signin', { email, password })
    cookies[as] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `photos.%.${run}@example.com`)) // their captures cascade
  await db.$client.end()
})

describe('POST /api/photos/upload-url', () => {
  it('US-10.1 creates the capture processing and gives a presigned PUT of the private bucket, valid 10 min', async () => {
    const response = await post('/api/photos/upload-url', file, 'verified')
    expect(response.status).toBe(200)
    const { photoId, url, expiresAt } = UploadUrlResponse.parse(await response.json())
    expect(new URL(url).pathname).toMatch(new RegExp(`/incoming/${photoId}$`))
    expect(new URL(url).searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(590_000)
    const [row] = await db.select().from(photos).where(eq(photos.id, photoId))
    expect(row).toMatchObject({ status: 'processing', mime: 'image/png', bytes: 5_000_000, uploadedAt: null })
  })

  it('US-10.2 refuses a file out of the rules that skipped the client: 413 too large, 400 otherwise', async () => {
    const tooLarge = await post('/api/photos/upload-url', { ...file, bytes: 20_000_001 }, 'verified')
    expect(tooLarge.status).toBe(413)
    const gif = await post('/api/photos/upload-url', { ...file, contentType: 'image/gif' }, 'verified')
    expect(gif.status).toBe(400)
    expect((await codeOf(gif)).details).toEqual({ field: 'file', reason: 'type' })
    const small = await post('/api/photos/upload-url', { ...file, width: 320, height: 200 }, 'verified')
    expect((await codeOf(small)).details).toEqual({ field: 'file', reason: 'dimensions' })
  })

  it('US-08.1 refuses an unverified member with 403 email_unverified, a visitor with 401', async () => {
    const unverified = await post('/api/photos/upload-url', file, 'unverified')
    expect(unverified.status).toBe(403)
    expect((await codeOf(unverified)).details).toEqual({ reason: 'email_unverified' })
    expect((await post('/api/photos/upload-url', file)).status).toBe(401)
  })

  it('US-10.5 answers 429 with Retry-After past 3 uploads at once', async () => {
    for (let i = 0; i < 3; i++) expect((await post('/api/photos/upload-url', file, 'busy')).status).toBe(200)
    const fourth = await post('/api/photos/upload-url', file, 'busy')
    expect(fourth.status).toBe(429)
    expect(fourth.headers.get('retry-after')).toBe('600')
  })
})

describe('POST /api/photos/{id}/complete', () => {
  const body = { title: 'Dusk over Elwynn', gameVersion: 'wow-forever' }

  it('US-10.6 answers 422 when nothing reached the bucket, and the capture stays incomplete', async () => {
    const { photoId } = UploadUrlResponse.parse(await (await post('/api/photos/upload-url', file, 'verified')).json())
    const response = await post(`/api/photos/${photoId}/complete`, body, 'verified')
    expect(response.status).toBe(422)
    expect(await codeOf(response)).toMatchObject({ code: 'UNPROCESSABLE', details: { reason: 'missing' } })
    const [row] = await db.select({ uploadedAt: photos.uploadedAt }).from(photos).where(eq(photos.id, photoId))
    expect(row!.uploadedAt).toBeNull()
  })

  it("US-10.1 answers 404 for another member's capture or an unknown one, 400 for an empty title", async () => {
    const { photoId } = UploadUrlResponse.parse(await (await post('/api/photos/upload-url', file, 'verified')).json())
    expect((await post(`/api/photos/${photoId}/complete`, body, 'other')).status).toBe(404)
    expect((await post(`/api/photos/${crypto.randomUUID()}/complete`, body, 'verified')).status).toBe(404)
    expect((await post(`/api/photos/${photoId}/complete`, { ...body, title: '  ' }, 'verified')).status).toBe(400)
  })

  it('US-11.5 US-11.1 US-11.3 refuses an insult, a bad tag, a zone and a free zone together, a bad in-game time', async () => {
    const { photoId } = UploadUrlResponse.parse(await (await post('/api/photos/upload-url', file, 'other')).json())
    const refused = async (extra: Record<string, unknown>) => {
      const response = await post(`/api/photos/${photoId}/complete`, { ...body, ...extra }, 'other')
      expect(response.status).toBe(400)
      return (await codeOf(response)).details
    }
    expect(await refused({ caption: 'quel connard' })).toEqual({ field: 'caption', reason: 'insult' })
    expect(await refused({ tags: ['#night'] })).toEqual({ field: 'tags', reason: 'charset' })
    expect(await refused({ zone: 'atlantis' })).toEqual({ field: 'zone', reason: 'unknown' })
    await refused({ zone: 'stormwind', zoneCustom: 'Hidden Glade' })
    await refused({ inGameTime: '25:00' })
    await refused({ tags: Array.from({ length: 11 }, (_, i) => `tag ${i}`) })
  })

  it('US-10.1 answers the same to a capture already completed, without sending it twice', async () => {
    const { photoId } = UploadUrlResponse.parse(await (await post('/api/photos/upload-url', file, 'other')).json())
    // Completed as by an earlier call: the in-memory bucket of the Node server cannot receive the PUT
    await db
      .update(photos)
      .set({ title: 'Dusk', uploadedAt: new Date(), gameVersionId: sql`(select id from game_versions limit 1)` })
      .where(eq(photos.id, photoId))
    const response = await post(`/api/photos/${photoId}/complete`, body, 'other')
    expect(CompleteUploadResponse.parse(await response.json())).toEqual({ photoId, status: 'processing' })
    const sent = await db
      .select()
      .from(outbox)
      .where(sql`${outbox.payload}->>'photoId' = ${photoId}`)
    expect(sent).toEqual([])
  })
})
