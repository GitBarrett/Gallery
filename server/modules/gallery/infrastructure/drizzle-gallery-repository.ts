import { and, asc, count, desc, eq, gte, lt, lte, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { avatarPath } from '../../../../shared/domain/avatar-file'
import { TIME_OF_DAY_RANGES } from '../../../../shared/domain/time-of-day'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photoMetadata, photos, photoTags, tags, users, zones } from '../../../db/schema'
import type { GalleryRepository, GridFilter } from '../application/grid'
import type { GalleryPhotos } from '../application/photo'
import type { GalleryHome } from '../application/home'
import type { GalleryRelated, PhotoContext } from '../application/related'
import type { GallerySearch } from '../application/search'
import type { GallerySitemap } from '../application/sitemap'

// Read view of the grids (10 § Règles, "vue de lecture documentée"): the published captures with their author
// (media → identity), version and zone (catalogue); the accounts banned or being deleted are left out (US-03.5).
// The recent sort has no key of its own: the publication date, then the id
const sortKey = (sort: GridFilter['sort']) =>
  sort === 'popular' ? photos.likesCount : sort === 'downloads' ? photos.downloadsCount : undefined

function timeOfDay(range: GridFilter['timeOfDay']): SQL | undefined {
  if (!range) return undefined
  const [from, to] = TIME_OF_DAY_RANGES[range]
  const time = photoMetadata.inGameTime
  return from < to ? and(gte(time, from), lt(time, to)) : or(gte(time, from), lt(time, to))
}

// What anyone may see, on the grids and the photo page alike (annexe B)
const visible = () =>
  and(
    eq(photos.status, 'published'),
    eq(gameVersions.archived, false),
    notInArray(users.status, ['banned', 'pending_deletion']),
  )
const names = (slug: string | null, nameEn: string | null, nameFr: string | null) =>
  slug ? { slug, nameEn: nameEn!, nameFr: nameFr! } : null

// A search (ADR-007): the words of its text in the title, description, character or free zone (`simple` + unaccent,
// all the words: websearch_to_tsquery), or the zone of the dictionary it names, or one of the tags it names
type Match = NonNullable<GridFilter['match']>
const query = (m: Match) => sql`websearch_to_tsquery('simple', public.f_unaccent(${m.text}))`
const tagged = (m: Match) =>
  m.tags.length
    ? sql`exists (select 1 from ${photoTags} join ${tags} on ${tags.id} = ${photoTags.tagId}
        where ${photoTags.photoId} = ${photos.id} and ${tags.slug} in (${sql.join(
          m.tags.map((t) => sql`${t}`),
          sql`, `,
        )}))`
    : sql`false`
const zoned = (m: Match) => (m.zoneId ? sql`${photoMetadata.zoneId} = ${m.zoneId}::uuid` : sql`false`)
function matching(m: Match) {
  const q = query(m)
  return sql`(${photos.searchVector} @@ ${q} or ${photoMetadata.searchVector} @@ ${q} or ${zoned(m)} or ${tagged(m)})`
}
// ADR-007: text rank × 0,6 + likes × 0,3 (log, 1 000 likes = 1) + recency × 0,1 (halves in about 3 weeks); the zone and
// the tags named weigh like a title word
function score(m: Match) {
  const q = query(m)
  const rank = sql`(ts_rank(${photos.searchVector}, ${q}) + ts_rank(coalesce(${photoMetadata.searchVector}, ''::tsvector), ${q})
    + case when ${zoned(m)} then 0.6 else 0 end + case when ${tagged(m)} then 0.6 else 0 end)`
  const likes = sql`least(ln(${photos.likesCount} + 1) / ln(1001), 1)`
  const recency = sql`exp(-extract(epoch from now() - ${photos.publishedAt}) / 2592000)`
  return sql`(${rank} * 0.6 + ${likes} * 0.3 + ${recency} * 0.1)`
}

// The capture just after `c` in the grid of its version, newest first (`older`), or just before it (newer). Its
// position is read from the table itself: the Date of `c` holds milliseconds, `published_at` microseconds, and a date
// written by now() would put `c` after its own truncated date (it would be its own neighbour).
async function neighbour(db: Db | Transaction, c: PhotoContext, older: boolean) {
  const at = sql`(select p.published_at, p.id from photos p where p.id = ${c.id}::uuid)`
  const [row] = await db
    .select({ id: photos.id })
    .from(photos)
    .innerJoin(users, eq(users.id, photos.userId))
    .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
    .where(
      and(
        visible(),
        eq(gameVersions.slug, c.gameVersion),
        older ? sql`(${photos.publishedAt}, ${photos.id}) < ${at}` : sql`(${photos.publishedAt}, ${photos.id}) > ${at}`,
      ),
    )
    .orderBy(...(older ? [desc(photos.publishedAt), desc(photos.id)] : [asc(photos.publishedAt), asc(photos.id)]))
    .limit(1)
  return row?.id ?? null
}

export const drizzleGalleryRepository = (
  db: Db | Transaction,
): GalleryRepository & GalleryPhotos & GalleryRelated & GalleryHome & GallerySearch & GallerySitemap => ({
  // shortcut: every URL in memory at once; fine up to some 100 000 captures, page by id beyond
  async sitemapEntries() {
    const versions = await db
      .select({ slug: gameVersions.slug })
      .from(gameVersions)
      .where(eq(gameVersions.archived, false))
      .orderBy(asc(gameVersions.position))
    const captures = await db
      .select({ id: photos.id, username: users.username, publishedAt: photos.publishedAt })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .where(visible())
      .orderBy(desc(photos.publishedAt), desc(photos.id))
    // A profile: its latest public capture as its last change
    const authors = new Map<string, Date>()
    for (const c of captures) if (!authors.has(c.username)) authors.set(c.username, c.publishedAt!)
    return [
      ...versions.map((v) => ({ path: `/v/${v.slug}` })),
      ...[...authors].map(([username, lastmod]) => ({ path: `/u/${encodeURIComponent(username)}`, lastmod })),
      ...captures.map((c) => ({ path: `/p/${c.id}`, lastmod: c.publishedAt! })),
    ]
  },

  async popularTags(limit) {
    // shortcut: counts every public tagged capture on each empty search; fine for tens of thousands, cache it beyond
    const rows = await db
      .select({ slug: tags.slug })
      .from(photoTags)
      .innerJoin(tags, eq(tags.id, photoTags.tagId))
      .innerJoin(photos, eq(photos.id, photoTags.photoId))
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .where(visible())
      .groupBy(tags.slug)
      .orderBy(desc(count()), sql`${tags.slug} collate "C"`)
      .limit(limit)
    return rows.map((r) => r.slug)
  },

  async context(id) {
    const [row] = await db
      .select({
        id: photos.id,
        userId: photos.userId,
        zoneId: photoMetadata.zoneId,
        gameVersion: gameVersions.slug,
        publishedAt: photos.publishedAt,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .leftJoin(photoMetadata, eq(photoMetadata.photoId, photos.id))
      .where(and(eq(photos.id, id), visible()))
    return row ? { ...row, zoneId: row.zoneId ?? null, publishedAt: row.publishedAt! } : null
  },

  async neighbours(c) {
    return { prev: await neighbour(db, c, false), next: await neighbour(db, c, true) }
  },

  async hero(photoId, maxLuminance) {
    const [row] = await db
      .select({
        id: photos.id,
        title: photos.title,
        width: photos.width,
        height: photos.height,
        focalX: photos.focalX,
        focalY: photos.focalY,
        username: users.username,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .where(
        and(
          visible(),
          lte(photos.lumaBl, maxLuminance), // a capture not measured (null) is never a hero
          photoId ? eq(photos.id, photoId) : undefined,
        ),
      )
      .orderBy(desc(photos.publishedAt), desc(photos.id))
      .limit(1)
    return row ? { ...row, title: row.title ?? '' } : null
  },

  async grid(filter) {
    const key = sortKey(filter.sort)
    const after = filter.after
    const position = after
      ? key
        ? sql`(${key}, ${photos.publishedAt}, ${photos.id}) < (${after.key}, ${after.publishedAt.toISOString()}::timestamptz, ${after.id}::uuid)`
        : sql`(${photos.publishedAt}, ${photos.id}) < (${after.publishedAt.toISOString()}::timestamptz, ${after.id}::uuid)`
      : undefined
    const rows = await db
      .select({
        id: photos.id,
        title: photos.title,
        width: photos.width,
        height: photos.height,
        username: users.username,
        zoneSlug: zones.slug,
        zoneNameEn: zones.nameEn,
        zoneNameFr: zones.nameFr,
        likes: photos.likesCount,
        downloads: photos.downloadsCount,
        publishedAt: photos.publishedAt,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .leftJoin(photoMetadata, eq(photoMetadata.photoId, photos.id))
      .leftJoin(zones, eq(zones.id, photoMetadata.zoneId))
      .where(
        and(
          visible(),
          filter.gameVersion ? eq(gameVersions.slug, filter.gameVersion) : undefined,
          filter.zoneId ? eq(photoMetadata.zoneId, filter.zoneId) : undefined,
          filter.authorId ? eq(photos.userId, filter.authorId) : undefined,
          filter.exclude?.length ? notInArray(photos.id, filter.exclude) : undefined,
          filter.publishedSince ? gte(photos.publishedAt, filter.publishedSince) : undefined,
          timeOfDay(filter.timeOfDay),
          filter.minLikes > 0 ? gte(photos.likesCount, filter.minLikes) : undefined,
          filter.match ? matching(filter.match) : undefined,
          position,
        ),
      )
      .orderBy(
        ...(filter.match && filter.relevance
          ? [desc(score(filter.match)), desc(photos.id)]
          : [...(key ? [desc(key)] : []), desc(photos.publishedAt), desc(photos.id)]),
      )
      .limit(filter.limit)
      .offset(filter.relevance?.offset ?? 0)
    return rows.map(({ zoneSlug, zoneNameEn, zoneNameFr, title, publishedAt, ...row }) => ({
      ...row,
      title: title ?? '', // published: a title is required at upload (photos_uploaded_check)
      publishedAt: publishedAt!, // set on publication
      zone: names(zoneSlug, zoneNameEn, zoneNameFr),
    }))
  },

  async photo(id) {
    const [row] = await db
      .select({
        id: photos.id,
        title: photos.title,
        description: photos.description,
        altText: photos.altText,
        caption: photoMetadata.caption,
        width: photos.width,
        height: photos.height,
        mime: photos.mime,
        bytes: photos.bytes,
        versionSlug: gameVersions.slug,
        versionNameEn: gameVersions.nameEn,
        versionNameFr: gameVersions.nameFr,
        zoneSlug: zones.slug,
        zoneNameEn: zones.nameEn,
        zoneNameFr: zones.nameFr,
        inGameTime: photoMetadata.inGameTime,
        graphicsSettings: photoMetadata.graphicsSettings,
        characterName: photoMetadata.characterName,
        userId: users.id,
        username: users.username,
        avatarKey: users.avatarKey,
        likes: photos.likesCount,
        downloads: photos.downloadsCount,
        publishedAt: photos.publishedAt,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
      .leftJoin(photoMetadata, eq(photoMetadata.photoId, photos.id))
      .leftJoin(zones, eq(zones.id, photoMetadata.zoneId))
      .where(and(eq(photos.id, id), visible()))
    if (!row) return null
    const tagged = await db
      .select({ slug: tags.slug })
      .from(photoTags)
      .innerJoin(tags, eq(tags.id, photoTags.tagId))
      .where(eq(photoTags.photoId, id))
      .orderBy(asc(tags.slug))
    const { versionSlug, versionNameEn, versionNameFr, zoneSlug, zoneNameEn, zoneNameFr, ...rest } = row
    const { userId, username, avatarKey, title, publishedAt, ...details } = rest
    return {
      ...details,
      title: title ?? '', // published: a title is required at upload (photos_uploaded_check)
      publishedAt: publishedAt!, // set on publication
      version: names(versionSlug, versionNameEn, versionNameFr)!,
      zone: names(zoneSlug, zoneNameEn, zoneNameFr),
      tags: tagged.map((t) => t.slug),
      author: { username, avatarUrl: avatarPath(userId, avatarKey) },
    }
  },
})
