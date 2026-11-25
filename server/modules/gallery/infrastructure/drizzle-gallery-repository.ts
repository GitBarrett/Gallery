import { and, desc, eq, gte, lt, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { TIME_OF_DAY_RANGES } from '../../../../shared/domain/time-of-day'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photoMetadata, photos, users, zones } from '../../../db/schema'
import type { GalleryRepository, GridFilter } from '../application/grid'

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

export const drizzleGalleryRepository = (db: Db | Transaction): GalleryRepository => ({
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
          eq(photos.status, 'published'),
          eq(gameVersions.archived, false),
          notInArray(users.status, ['banned', 'pending_deletion']),
          filter.gameVersion ? eq(gameVersions.slug, filter.gameVersion) : undefined,
          filter.zoneId ? eq(photoMetadata.zoneId, filter.zoneId) : undefined,
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
      zone: zoneSlug ? { slug: zoneSlug, nameEn: zoneNameEn!, nameFr: zoneNameFr! } : null,
    }))
  },
})
