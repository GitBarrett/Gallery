import { and, asc, desc, eq, gte, lt, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { avatarPath } from '../../../../shared/domain/avatar-file'
import { TIME_OF_DAY_RANGES } from '../../../../shared/domain/time-of-day'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photoMetadata, photos, photoTags, tags, users, zones } from '../../../db/schema'
import type { GalleryRepository, GridFilter } from '../application/grid'
import type { GalleryPhotos } from '../application/photo'
import type { GalleryRelated, PhotoContext } from '../application/related'

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

// The capture just after `c` in the grid of its version, newest first (`older`), or just before it (newer)
async function neighbour(db: Db | Transaction, c: PhotoContext, older: boolean) {
  const at = sql`(${c.publishedAt.toISOString()}::timestamptz, ${c.id}::uuid)`
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

export const drizzleGalleryRepository = (db: Db | Transaction): GalleryRepository & GalleryPhotos & GalleryRelated => ({
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
          timeOfDay(filter.timeOfDay),
          filter.minLikes > 0 ? gte(photos.likesCount, filter.minLikes) : undefined,
          position,
        ),
      )
      .orderBy(...(key ? [desc(key)] : []), desc(photos.publishedAt), desc(photos.id))
      .limit(filter.limit)
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
