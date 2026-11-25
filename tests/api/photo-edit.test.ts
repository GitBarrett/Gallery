import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { gameVersions, photos, users } from '../../server/db/schema'
import { ErrorResponse } from '../../shared/contracts/errors'

// Edit and deletion of a capture over HTTP and Postgres (T-27a): the author only (IDOR, 08-securite.md annexe B).
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const cookies = { author: '', other: '' }
const ids = { published: crypto.randomUUID(), review: crypto.randomUUID() }

const send = (method: 'PATCH' | 'DELETE', id: string, as: keyof typeof cookies, body?: unknown) =>
  fetch(`/api/photos/${id}`, {
    method,
    headers: {
      'sec-fetch-site': 'same-origin',
      'cf-connecting-ip': run,
      cookie: cookies[as],
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const titleOf = async (id: string) => (await db.select().from(photos).where(eq(photos.id, id)))[0]?.title

beforeAll(async () => {
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  for (const as of Object.keys(cookies) as (keyof typeof cookies)[]) {
    const email = `edit.${as}.${run}@example.com`
    const [user] = await db
      .insert(users)
      .values({
        email,
        username: `edit_${as.slice(0, 5)}_${run}`,
        passwordHash: phc(password),
        emailVerifiedAt: new Date(),
      })
      .returning()
    if (as === 'author') {
      const capture = { userId: user!.id, mime: 'image/png', bytes: 1, width: 1920, height: 1080 }
      const completed = { title: 'Dusk', gameVersionId: version!.id, uploadedAt: new Date() }
      await db.insert(photos).values([
        { ...capture, ...completed, id: ids.published, status: 'published' },
        { ...capture, ...completed, id: ids.review, status: 'pending_review' },
      ])
    }
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email, password }),
    })
    cookies[as] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `edit.%.${run}@example.com`))
  await db.$client.end()
})

describe('PATCH and DELETE /api/photos/{id}', () => {
  it("US-12.3 refuses another member's capture, 403 when published and 404 otherwise, and changes nothing", async () => {
    const forbidden = await send('PATCH', ids.published, 'other', { title: 'Mine now' })
    expect(forbidden.status).toBe(403)
    expect(ErrorResponse.parse(await forbidden.json()).error.details).toEqual({ reason: 'owner' })
    expect((await send('PATCH', ids.review, 'other', { title: 'Mine now' })).status).toBe(404)
    expect((await send('DELETE', ids.published, 'other')).status).toBe(403)
    expect((await send('DELETE', ids.review, 'other')).status).toBe(404)
    expect([await titleOf(ids.published), await titleOf(ids.review)]).toEqual(['Dusk', 'Dusk'])
  })

  it('US-12.1 lets the author edit, with the insult filter; US-12.2 then delete, once', async () => {
    expect((await send('PATCH', ids.published, 'author', { title: 'Dawn', caption: 'First light' })).status).toBe(204)
    expect(await titleOf(ids.published)).toBe('Dawn')
    const insult = await send('PATCH', ids.published, 'author', { caption: 'quel connard' })
    expect(insult.status).toBe(400)
    expect((await send('PATCH', ids.published, 'author', {})).status).toBe(400) // nothing to change
    expect((await send('DELETE', ids.published, 'author')).status).toBe(204)
    expect(await titleOf(ids.published)).toBeUndefined()
    expect((await send('DELETE', ids.published, 'author')).status).toBe(404)
  })
})
