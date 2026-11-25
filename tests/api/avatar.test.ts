import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { ErrorResponse } from '../../shared/contracts/errors'
import { AvatarUploadUrlResponse } from '../../shared/contracts/photos'

// Avatar upload over HTTP and Postgres (T-28a). The Node server's bucket stays empty: `complete` finds no object;
// the processing is covered by avatars.test.ts, the real PUT by the E2E of T-28b.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const cookies = { verified: '', unverified: '' }
const ids = { verified: '' }
const square = { contentType: 'image/webp', bytes: 150_000, width: 512, height: 512 }

const post = (path: string, body: unknown, as: keyof typeof cookies) =>
  fetch(path, {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'cf-connecting-ip': run,
      cookie: cookies[as],
    },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  for (const as of Object.keys(cookies) as (keyof typeof cookies)[]) {
    const email = `avatar.${as}.${run}@example.com`
    const [user] = await db
      .insert(users)
      .values({
        email,
        username: `av_${as.slice(0, 5)}_${run}`,
        passwordHash: phc(password),
        emailVerifiedAt: as === 'verified' ? new Date() : null,
      })
      .returning()
    if (as === 'verified') ids.verified = user!.id
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email, password }),
    })
    cookies[as] = (signedIn.headers.get('set-cookie') ?? '').split(';')[0]!
  }
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `avatar.%.${run}@example.com`))
  await db.$client.end()
})

describe('avatar upload', () => {
  it('US-07.6 gives a presigned PUT for a square file, the version pending, the shown avatar untouched', async () => {
    const response = await post('/api/me/avatar-upload-url', square, 'verified')
    expect(response.status).toBe(200)
    const { version, url } = AvatarUploadUrlResponse.parse(await response.json())
    expect(new URL(url).pathname).toMatch(new RegExp(`/incoming/avatars/${ids.verified}/${version}$`))
    const [row] = await db.select().from(users).where(eq(users.id, ids.verified))
    expect(row).toMatchObject({ avatarPendingKey: version, avatarKey: null })
    // Nothing was put: 422; a version that is not the pending one: 404
    const missing = await post('/api/me/avatar/complete', { version }, 'verified')
    expect(missing.status).toBe(422)
    expect((await post('/api/me/avatar/complete', { version: crypto.randomUUID() }, 'verified')).status).toBe(404)
    expect((await fetch(`/avatar/${ids.verified}/${version}/128`)).status).toBe(404) // pending: never served
  })

  it('US-07.6 refuses a file not square or over 2 MB, and an unverified member', async () => {
    const notSquare = await post('/api/me/avatar-upload-url', { ...square, height: 400 }, 'verified')
    expect(notSquare.status).toBe(400)
    expect(ErrorResponse.parse(await notSquare.json()).error.details).toEqual({ field: 'file', reason: 'dimensions' })
    expect((await post('/api/me/avatar-upload-url', { ...square, bytes: 2_000_001 }, 'verified')).status).toBe(413)
    expect((await post('/api/me/avatar-upload-url', square, 'unverified')).status).toBe(403)
  })
})
