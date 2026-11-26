import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import { gameVersions, photoMetadata, photos, photoTags, tags, users, zones } from '../../../db/schema'
import type { GridFilter } from '../application/grid'
import { drizzleGalleryRepository } from './drizzle-gallery-repository'

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0]
const T0 = Date.UTC(2026, 10, 25, 10)
const base: GridFilter = { minLikes: 0, sort: 'recent', limit: 30 }

// A version and a zone of their own, so that the captures of the other tests never show
async function world(tx: Tx) {
  const run = crypto.randomUUID().slice(0, 8)
  const [version] = await tx
    .insert(gameVersions)
    .values({ slug: `gv-${run}`, nameEn: 'Test', nameFr: 'Test', position: 99 })
    .returning()
  const [archived] = await tx
    .insert(gameVersions)
    .values({ slug: `old-${run}`, nameEn: 'Old', nameFr: 'Old', position: 100, archived: true })
    .returning()
  const [zone] = await tx
    .insert(zones)
    .values({ slug: `zone-${run}`, nameEn: 'Stormwind City', nameFr: 'Hurlevent' })
    .returning()
  const [author] = await tx
    .insert(users)
    .values({ username: `grid_${run}` })
    .returning()
  let n = 0
  const capture = async (
    more: Partial<typeof photos.$inferInsert> = {},
    details: { time?: string; zone?: boolean } = {},
  ) => {
    n++
    const [row] = await tx
      .insert(photos)
      .values({
        userId: author!.id,
        gameVersionId: version!.id,
        title: `Capture ${n}`,
        status: 'published',
        mime: 'image/jpeg',
        bytes: 1,
        width: 1920,
        height: 1080,
        uploadedAt: new Date(T0),
        publishedAt: new Date(T0 + n * 60_000),
        ...more,
      })
      .returning()
    if (details.time || details.zone)
      await tx
        .insert(photoMetadata)
        .values({ photoId: row!.id, inGameTime: details.time, zoneId: details.zone ? zone!.id : null })
    return row!.id
  }
  return {
    version: version!.slug,
    archived: archived!,
    zone: zone!,
    author: author!,
    capture,
    archivedId: archived!.id,
  }
}

describe('drizzleGalleryRepository', () => {
  it('US-20.1 lists the published captures of a version only, most recent first', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const older = await w.capture()
      const newer = await w.capture({}, { zone: true })
      for (const status of ['processing', 'pending_review', 'rejected', 'hidden']) await w.capture({ status })
      await w.capture({ gameVersionId: w.archivedId })
      const rows = await drizzleGalleryRepository(tx).grid({ ...base, gameVersion: w.version })
      expect(rows.map((r) => r.id)).toEqual([newer, older])
      expect(rows[0]).toEqual({
        id: newer,
        title: 'Capture 2',
        width: 1920,
        height: 1080,
        username: w.author.username,
        zone: { slug: w.zone.slug, nameEn: 'Stormwind City', nameFr: 'Hurlevent' },
        likes: 0,
        downloads: 0,
        publishedAt: new Date(T0 + 2 * 60_000),
      })
      expect(await drizzleGalleryRepository(tx).grid({ ...base, gameVersion: w.archived.slug })).toEqual([])
    })
  })

  it('US-20.1 keeps the pages stable: captures published between two pages neither repeat nor shift them', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const ids: string[] = []
      for (let i = 0; i < 5; i++) ids.push(await w.capture())
      // Two captures published at the same instant: the id breaks the tie
      const same = { publishedAt: new Date(T0 + 3 * 60_000) }
      ids.push(await w.capture(same), await w.capture(same))
      const repo = drizzleGalleryRepository(tx)
      const seen: string[] = []
      let after: GridFilter['after']
      for (;;) {
        const page = await repo.grid({ ...base, gameVersion: w.version, limit: 2, after })
        if (page.length === 0) break
        seen.push(...page.map((r) => r.id))
        const last = page.at(-1)!
        after = { key: 0, publishedAt: last.publishedAt, id: last.id }
        await w.capture({ publishedAt: new Date(T0 + 3_600_000 + seen.length) }) // newer: before the cursor
      }
      expect(seen).toHaveLength(ids.length)
      expect(new Set(seen)).toEqual(new Set(ids))
    })
  })

  it('US-20.3 filters by zone, time of day and minimum likes, sorts by likes or downloads', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const dawn = await w.capture({ likesCount: 20, downloadsCount: 1 }, { time: '06:30', zone: true })
      const night = await w.capture({ likesCount: 5, downloadsCount: 9 }, { time: '23:10' })
      const midnight = await w.capture({ likesCount: 60 }, { time: '02:00' })
      const untimed = await w.capture({ likesCount: 1, downloadsCount: 4 })
      const repo = drizzleGalleryRepository(tx)
      const ids = async (filter: Partial<GridFilter>) =>
        (await repo.grid({ ...base, gameVersion: w.version, ...filter })).map((r) => r.id)
      expect(await ids({ zoneId: w.zone.id })).toEqual([dawn])
      expect(await ids({ timeOfDay: 'dawn' })).toEqual([dawn])
      expect(await ids({ timeOfDay: 'night' })).toEqual([midnight, night])
      expect(await ids({ timeOfDay: 'day' })).toEqual([])
      expect(await ids({ minLikes: 15 })).toEqual([midnight, dawn])
      expect(await ids({ sort: 'popular' })).toEqual([midnight, dawn, night, untimed])
      expect(await ids({ sort: 'downloads' })).toEqual([night, untimed, dawn, midnight])
      // Next page of the popular sort: after the likes of the last capture seen
      const after = { key: 20, publishedAt: new Date(T0 + 60_000), id: dawn }
      expect(await ids({ sort: 'popular', after })).toEqual([night, untimed])
    })
  })

  it('leaves out the captures of an account banned or being deleted', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      await w.capture()
      const [banned] = await tx
        .insert(users)
        .values({ username: `banned_${crypto.randomUUID().slice(0, 8)}`, status: 'banned' })
        .returning()
      await w.capture({ userId: banned!.id })
      expect(await drizzleGalleryRepository(tx).grid({ ...base, gameVersion: w.version })).toHaveLength(1)
    })
  })

  it('US-25.1 reads one published capture with its details, version, zone, tags and author', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const id = await w.capture(
        { description: 'Low sun.', altText: 'A harbour at dawn', likesCount: 12 },
        { zone: true, time: '06:10' },
      )
      await tx
        .update(photoMetadata)
        .set({ caption: 'First light.', characterName: 'Ysolde' })
        .where(eq(photoMetadata.photoId, id))
      const run = crypto.randomUUID().slice(0, 8)
      const made = await tx
        .insert(tags)
        .values([
          { slug: `night-${run}`, label: 'night' },
          { slug: `harbour-${run}`, label: 'harbour' },
        ])
        .returning()
      await tx.insert(photoTags).values(made.map((t) => ({ photoId: id, tagId: t.id })))
      const avatar = crypto.randomUUID()
      await tx.update(users).set({ avatarKey: avatar }).where(eq(users.id, w.author.id))

      expect(await drizzleGalleryRepository(tx).photo(id)).toEqual({
        id,
        title: 'Capture 1',
        description: 'Low sun.',
        altText: 'A harbour at dawn',
        caption: 'First light.',
        width: 1920,
        height: 1080,
        mime: 'image/jpeg',
        bytes: 1,
        version: { slug: w.version, nameEn: 'Test', nameFr: 'Test' },
        zone: { slug: w.zone.slug, nameEn: 'Stormwind City', nameFr: 'Hurlevent' },
        inGameTime: '06:10',
        graphicsSettings: null,
        characterName: 'Ysolde',
        tags: [`harbour-${run}`, `night-${run}`],
        author: { username: w.author.username, avatarUrl: `/avatar/${w.author.id}/${avatar}` },
        likes: 12,
        downloads: 0,
        publishedAt: new Date(T0 + 60_000),
      })
    })
  })

  it('US-25.1 finds no capture that is not public: in review, hidden, archived version, banned author', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const [banned] = await tx
        .insert(users)
        .values({ username: `banned_${crypto.randomUUID().slice(0, 8)}`, status: 'banned' })
        .returning()
      const repo = drizzleGalleryRepository(tx)
      for (const more of [
        { status: 'pending_review' },
        { status: 'hidden' },
        { status: 'rejected' },
        { gameVersionId: w.archivedId },
        { userId: banned!.id },
      ])
        expect(await repo.photo(await w.capture(more)), JSON.stringify(more)).toBeNull()
      expect(await repo.photo(crypto.randomUUID())).toBeNull()
    })
  })

  it('US-70.1 filters the grid by author and leaves out the captures given', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const [jaina] = await tx
        .insert(users)
        .values({ username: `jaina_${crypto.randomUUID().slice(0, 8)}` })
        .returning()
      const shown = await w.capture()
      const mine = await w.capture()
      await w.capture({ userId: jaina!.id })
      const repo = drizzleGalleryRepository(tx)
      const ids = async (filter: Partial<GridFilter>) =>
        (await repo.grid({ ...base, gameVersion: w.version, ...filter })).map((r) => r.id)
      expect(await ids({ authorId: w.author.id, exclude: [shown] })).toEqual([mine])
    })
  })

  it('US-67.2 gives the context of a public capture and its neighbours in its version, newest first', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const oldest = await w.capture({}, { zone: true })
      await w.capture({ status: 'hidden' }) // never a neighbour
      const middle = await w.capture()
      const newest = await w.capture()
      const repo = drizzleGalleryRepository(tx)
      const context = (await repo.context(oldest))!
      expect(context).toEqual({
        id: oldest,
        userId: w.author.id,
        zoneId: w.zone.id,
        gameVersion: w.version,
        publishedAt: new Date(T0 + 60_000),
      })
      expect(await repo.neighbours(context)).toEqual({ prev: middle, next: null }) // the oldest: no next
      expect(await repo.neighbours((await repo.context(middle))!)).toEqual({ prev: newest, next: oldest })
      expect(await repo.neighbours((await repo.context(newest))!)).toEqual({ prev: null, next: middle })
      // A date with microseconds (written by now()) is not after itself: never its own neighbour
      await tx
        .update(photos)
        .set({ publishedAt: sql`${photos.publishedAt} + interval '400 microseconds'` })
        .where(eq(photos.id, newest))
      expect(await repo.neighbours((await repo.context(newest))!)).toEqual({ prev: null, next: middle })
      expect(await repo.context(await w.capture({ status: 'pending_review' }))).toBeNull()
    })
  })

  it('US-70.4 filters the grid by publication date', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      await w.capture() // T0 + 1 min
      const later = await w.capture({ publishedAt: new Date(T0 + 3_600_000) })
      const rows = await drizzleGalleryRepository(tx).grid({
        ...base,
        gameVersion: w.version,
        publishedSince: new Date(T0 + 1_800_000),
      })
      expect(rows.map((r) => r.id)).toEqual([later])
    })
  })

  it('US-24.1 gives a hero only from a public capture dark enough at the bottom left, the latest without a choice', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const dark = await w.capture({ lumaBl: 0.4, focalX: 0.25, focalY: 0.5 })
      const bright = await w.capture({ lumaBl: 0.7 })
      const unmeasured = await w.capture()
      const hidden = await w.capture({ lumaBl: 0.2, status: 'hidden' })
      const repo = drizzleGalleryRepository(tx)
      expect(await repo.hero(dark, 0.6)).toEqual({
        id: dark,
        title: 'Capture 1',
        width: 1920,
        height: 1080,
        focalX: 0.25,
        focalY: 0.5,
        username: w.author.username,
      })
      for (const id of [bright, unmeasured, hidden]) expect(await repo.hero(id, 0.6), id).toBeNull()
      // Without a choice: the latest one dark enough (far in the future, ahead of the captures of other tests)
      const latest = await w.capture({ lumaBl: 0.5, publishedAt: new Date('2099-01-01T00:00:00Z') })
      expect((await repo.hero(null, 0.6))?.id).toBe(latest)
    })
  })

  it('US-21.1 US-21.4 searches the title, description, character, free zone, the zone named and the tags', async () => {
    await withRollback(async (tx) => {
      const w = await world(tx)
      const run = crypto.randomUUID().slice(0, 6)
      const word = (s: string) => `${s}${run}` // words of this test only
      const inTitle = await w.capture({ title: `Dawn over ${word('nagrand')}` })
      const inDescription = await w.capture({ description: `Low sun on ${word('nagrand')} hills` })
      const accented = await w.capture({ title: `Éclat ${word('lunaire')}` })
      const character = await w.capture()
      await tx.insert(photoMetadata).values({ photoId: character, characterName: word('Ysolde') })
      const inZone = await w.capture({}, { zone: true })
      const taggedId = await w.capture()
      const [tag] = await tx
        .insert(tags)
        .values({ slug: word('night'), label: word('night') })
        .returning()
      await tx.insert(photoTags).values({ photoId: taggedId, tagId: tag!.id })
      await w.capture({ title: `Hidden ${word('nagrand')}`, status: 'hidden' })
      await w.capture({ title: 'Nothing to see' })
      const repo = drizzleGalleryRepository(tx)
      const search = async (text: string, zoneId: string | null = null, tagList: string[] = []) =>
        (
          await repo.grid({
            ...base,
            gameVersion: w.version,
            match: { text, zoneId, tags: tagList },
            relevance: { offset: 0 },
          })
        ).map((r) => r.id)

      // The title (A) ranks above the description (C); never a capture that is not public
      expect(await search(word('nagrand'))).toEqual([inTitle, inDescription])
      expect(await search(`eclat ${word('lunaire')}`)).toEqual([accented]) // accents ignored, every word
      expect(await search(word('ysolde'))).toEqual([character])
      expect(await search('anything', w.zone.id)).toEqual([inZone]) // the zone the query names
      expect(await search('anything', null, [word('night')])).toEqual([taggedId])
      expect(await search(`${word('nagrand')} ${word('absent')}`)).toEqual([]) // all the words
    })
  })
})
