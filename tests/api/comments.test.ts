import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { gameVersions, outbox, photos, users } from '../../server/db/schema'
import { CommentEdited, CommentItem, CommentsResponse } from '../../shared/contracts/comments'

// Comments (T-41a) over HTTP and Postgres; the rules, the limit and Turnstile are checked by comments.test.ts.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const photoId = crypto.randomUUID()
const cookies = { author: '', fan: '', other: '', unverified: '' }
const OLD = new Date('2026-01-01T00:00:00Z') // older than a day: no Turnstile

beforeAll(async () => {
  const account = (who: string, verified = true) => ({
    email: `comments.${who}.${run}@example.com`,
    username: `com_${who.slice(0, 4)}_${run}`,
    passwordHash: phc(password),
    emailVerifiedAt: verified ? OLD : null,
    createdAt: OLD,
  })
  const [author] = await db
    .insert(users)
    .values([account('author'), account('fan'), account('other'), account('unverified', false)])
    .returning()
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  await db.insert(photos).values({
    id: photoId,
    userId: author!.id,
    gameVersionId: version!.id,
    title: 'Comments',
    status: 'published',
    mime: 'image/png',
    bytes: 1,
    width: 1920,
    height: 1080,
    uploadedAt: new Date(),
    publishedAt: new Date(),
  })
  for (const who of Object.keys(cookies) as (keyof typeof cookies)[]) {
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email: `comments.${who}.${run}@example.com`, password }),
    })
    cookies[who] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `comments.%.${run}@example.com`)) // captures and comments cascade
  await db.$client.end()
})

const send = (method: string, path: string, cookie = '', body?: unknown) =>
  fetch(path, {
    method,
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

describe('comments API', () => {
  it('US-31.1 posts a comment kept as written, listed at once, and tells the author of the capture', async () => {
    const xss = '<img src=x onerror=alert(1)> **bold** https://example.com'
    const posted = await send('POST', `/api/photos/${photoId}/comments`, cookies.fan, { body: `  ${xss}  ` })
    expect(posted.status).toBe(201)
    const comment = CommentItem.parse(await posted.json())
    expect(comment).toMatchObject({ body: xss, author: { username: `com_fan_${run}` }, editedAt: null })
    const list = await send('GET', `/api/photos/${photoId}/comments`)
    expect(list.headers.get('cache-control')).toBe('no-store')
    expect(CommentsResponse.parse(await list.json()).items.map((c) => c.id)).toContain(comment.id)
    const [photo] = await db.select({ n: photos.commentsCount }).from(photos).where(eq(photos.id, photoId))
    expect(photo!.n).toBe(1)
    const events = await db
      .select({ type: sql<string>`${outbox.payload}->>'type'` })
      .from(outbox)
      .where(sql`${outbox.payload}->>'commentId' = ${comment.id}`)
    expect(events).toEqual([{ type: 'comment' }])
  })

  it('US-31.2 US-08.1 refuses an insult (400), an unverified member (403) and a visitor (401)', async () => {
    const insult = await send('POST', `/api/photos/${photoId}/comments`, cookies.fan, { body: 'What a connard' })
    expect(insult.status).toBe(400)
    expect((await insult.json()).error.details).toEqual({ field: 'body', reason: 'insult' })
    const unverified = await send('POST', `/api/photos/${photoId}/comments`, cookies.unverified, { body: 'Hi' })
    expect(unverified.status).toBe(403)
    expect((await unverified.json()).error.details).toEqual({ reason: 'email_unverified' })
    expect((await send('POST', `/api/photos/${photoId}/comments`, '', { body: 'Hi' })).status).toBe(401)
  })

  it('US-31.3 US-31.4 edits its own comment, marked edited; the author of the capture deletes it, nobody else', async () => {
    const posted = await send('POST', `/api/photos/${photoId}/comments`, cookies.fan, { body: 'Nice' })
    const { id } = CommentItem.parse(await posted.json())
    const edited = await send('PATCH', `/api/comments/${id}`, cookies.fan, { body: 'Nicer' })
    expect(CommentEdited.parse(await edited.json())).toMatchObject({ id, body: 'Nicer' })
    expect((await send('PATCH', `/api/comments/${id}`, cookies.other, { body: 'Mine' })).status).toBe(403)
    expect((await send('DELETE', `/api/comments/${id}`, cookies.other)).status).toBe(403)
    expect((await send('DELETE', `/api/comments/${id}`, cookies.author)).status).toBe(204)
    expect((await send('DELETE', `/api/comments/${id}`, cookies.author)).status).toBe(404)
    expect((await send('PATCH', `/api/comments/not-a-uuid`, cookies.fan, { body: 'x' })).status).toBe(400)
  })
})
