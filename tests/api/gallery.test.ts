import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { gameVersions, photoMetadata, photos, users, zones } from '../../server/db/schema'
import { ErrorResponse } from '../../shared/contracts/errors'
import { PhotosResponse } from '../../shared/contracts/photos'

// GET /api/photos over HTTP and Postgres (T-30a): a zone of its own keeps the captures of the other tests out.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const zone = `gridzone-${run}`
const ids: string[] = []

beforeAll(async () => {
  const [author] = await db
    .insert(users)
    .values({ username: `Grid_${run}` })
    .returning()
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const [place] = await db
    .insert(zones)
    .values({ slug: zone, nameEn: `Gridzone ${run}`, nameFr: `Gridzone ${run}` })
    .returning()
  for (const [n, status] of [
    [1, 'published'],
    [2, 'published'],
    [3, 'published'],
    [4, 'pending_review'],
  ] as const) {
    const [photo] = await db
      .insert(photos)
      .values({
        userId: author!.id,
        gameVersionId: version!.id,
        title: `Grid ${n}`,
        status,
        mime: 'image/jpeg',
        bytes: 1,
        width: 1920,
        height: 1080,
        uploadedAt: new Date(),
        publishedAt: status === 'published' ? new Date(Date.UTC(2026, 10, 25, 10, n)) : null,
        likesCount: n * 10,
      })
      .returning()
    await db.insert(photoMetadata).values({ photoId: photo!.id, zoneId: place!.id })
    ids.push(photo!.id)
  }
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.username, `Grid_${run}`))
  await db.delete(zones).where(eq(zones.slug, zone))
  await db.$client.end()
})

const get = (query: string) => fetch(`/api/photos?${query}`)

describe('GET /api/photos', () => {
  it('US-20.1 gives the published captures of a version by pages, most recent first, cached at the edge', async () => {
    const first = await get(`version=wow-forever&zone=${zone}&limit=2`)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
    const page = PhotosResponse.parse(await first.json())
    expect(page.items.map((c) => c.id)).toEqual([ids[2], ids[1]])
    expect(page.items[0]).toMatchObject({ title: 'Grid 3', author: { username: `Grid_${run}` }, likes: 30 })
    const next = PhotosResponse.parse(
      await (await get(`version=wow-forever&zone=${zone}&limit=2&cursor=${page.nextCursor}`)).json(),
    )
    expect(next).toEqual({ items: [expect.objectContaining({ id: ids[0] })], nextCursor: null })
  })

  it('US-20.3 applies the minimum quality from the thresholds of the settings, and the popular sort', async () => {
    // Launch thresholds (07 § Codes visuels): rare from 15 likes
    const page = PhotosResponse.parse(await (await get(`zone=${zone}&minQuality=rare&sort=popular`)).json())
    expect(page.items.map((c) => [c.id, c.quality])).toEqual([
      [ids[2], 'rare'],
      [ids[1], 'rare'],
    ])
  })

  it('US-20.4 answers 404 for an unknown version; 400 for an unknown zone, sort or an altered cursor', async () => {
    const unknown = await get('version=cataclysm')
    expect(unknown.status).toBe(404)
    expect(ErrorResponse.parse(await unknown.json()).error.code).toBe('NOT_FOUND')
    for (const [query, field] of [
      ['zone=nowhere-at-all', 'zone'],
      ['cursor=altered', 'cursor'],
    ]) {
      const response = await get(query!)
      expect(response.status, query).toBe(400)
      expect(ErrorResponse.parse(await response.json()).error.details).toMatchObject({ field })
    }
    expect((await get('sort=random')).status).toBe(400)
    expect((await get('limit=61')).status).toBe(400)
  })
})
