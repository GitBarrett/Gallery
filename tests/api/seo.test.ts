import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { gameVersions, photos, users } from '../../server/db/schema'

// Sitemap and robots (T-35a) over HTTP and Postgres. The Node server's bucket is empty: the sitemap is built on the
// spot, as before the first cron run. Other tests' captures are in the database too: only these ones are checked.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true' // the bucket in memory of the Node server
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const ids = { shown: crypto.randomUUID(), hidden: crypto.randomUUID(), rejected: crypto.randomUUID() }
const ofBanned = crypto.randomUUID()
const names = { author: `seo_a_${run}`, banned: `seo_b_${run}` }

beforeAll(async () => {
  const members = await db
    .insert(users)
    .values([
      { email: `seo.author.${run}@example.com`, username: names.author },
      { email: `seo.banned.${run}@example.com`, username: names.banned, status: 'banned' },
    ])
    .returning()
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const capture = { mime: 'image/png', bytes: 1, width: 1920, height: 1080, gameVersionId: version!.id }
  const done = { title: 'Seo', uploadedAt: new Date(), publishedAt: new Date('2026-11-25T10:00:00Z') }
  await db.insert(photos).values([
    { ...capture, ...done, id: ids.shown, userId: members[0]!.id, status: 'published' },
    { ...capture, ...done, id: ids.hidden, userId: members[0]!.id, status: 'hidden' },
    { ...capture, ...done, id: ids.rejected, userId: members[0]!.id, status: 'rejected' },
    { ...capture, ...done, id: ofBanned, userId: members[1]!.id, status: 'published' },
  ])
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `seo.%.${run}@example.com`)) // their captures cascade
  await db.$client.end()
})

const sitemap = async () => {
  const index = await (await fetch('/sitemap.xml')).text()
  const batches = [...index.matchAll(/<loc>http:\/\/localhost:3000\/(sitemap-\d+\.xml)<\/loc>/g)].map((m) => m[1]!)
  return (await Promise.all(batches.map(async (name) => (await fetch(`/${name}`)).text()))).join('')
}

describe('GET /sitemap.xml', () => {
  it('US-25.2 is an index of batches listing the home, the versions, the profiles and the public captures', async () => {
    const response = await fetch('/sitemap.xml')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(await response.text()).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    const urls = await sitemap()
    expect(urls).toContain('<url><loc>http://localhost:3000/</loc></url>')
    expect(urls).toContain('<url><loc>http://localhost:3000/v/wow-forever</loc></url>')
    expect(urls).toContain(`<url><loc>http://localhost:3000/p/${ids.shown}</loc><lastmod>2026-11-25</lastmod></url>`)
    expect(urls).toContain(`<loc>http://localhost:3000/u/${names.author}</loc>`)
    expect((await fetch('/sitemap-999999.xml')).status).toBe(404)
    expect((await fetch('/feed.xml')).status).toBe(404)
  })

  it('US-25.3 leaves out the hidden, rejected captures and the banned accounts, which are not found', async () => {
    const urls = await sitemap()
    for (const id of [ids.hidden, ids.rejected, ofBanned]) {
      expect(urls).not.toContain(id)
      expect((await fetch(`/api/photos/${id}`)).status).toBe(404)
      expect((await fetch(`/p/${id}`)).status).toBe(404)
    }
    expect(urls).not.toContain(names.banned)
    expect((await fetch(`/api/users/${names.banned}`)).status).toBe(404)
    // A deleted capture or account: no row left, not found (404, Q96)
    await db.delete(photos).where(eq(photos.id, ids.shown))
    expect((await fetch(`/p/${ids.shown}`)).status).toBe(404)
    expect(await sitemap()).not.toContain(ids.shown)
  })
})

describe('GET /robots.txt', () => {
  it('US-25.4 leaves out the private areas in both languages and gives the sitemap', async () => {
    const response = await fetch('/robots.txt')
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe(
      [
        'User-agent: *',
        'Disallow: /admin',
        'Disallow: /settings',
        'Disallow: /api',
        'Disallow: /upload',
        'Disallow: /fr/admin',
        'Disallow: /fr/settings',
        'Disallow: /fr/upload',
        '',
        'Sitemap: http://localhost:3000/sitemap.xml',
        '',
      ].join('\n'),
    )
    expect(response.headers.get('x-robots-tag')).toBeNull() // not a preview
  })
})
