import { z } from './zod'
import { AvatarUrl } from './auth'
import { GRID_SORTS } from '../domain/grid-sort'
import { QUALITIES } from '../domain/quality'
import { TIMES_OF_DAY } from '../domain/time-of-day'

/**
 * POST /api/photos/upload-url: the file the browser is about to send (US-10.1), checked again by the server against
 * shared/domain/capture-file.ts (US-10.2). The presigned URL is signed on `contentType` and `bytes`.
 */
export const UploadUrlBody = z.strictObject({
  contentType: z.string().max(100),
  bytes: z.int().min(0).max(1_000_000_000),
  width: z.int().min(0).max(100_000),
  height: z.int().min(0).max(100_000),
})
export type UploadUrlBody = z.infer<typeof UploadUrlBody>

/** PUT the file to `url` with the declared `Content-Type` before `expiresAt` (10 min), then call `complete`. */
export const UploadUrlResponse = z.strictObject({ photoId: z.uuid(), url: z.url(), expiresAt: z.iso.datetime() })
export type UploadUrlResponse = z.infer<typeof UploadUrlResponse>

/**
 * POST /api/photos/{id}/complete, once the PUT succeeded: title and game version of the capture (US-10.1). Accepts
 * an `Idempotency-Key` header; a second call answers the same without processing the capture twice.
 */
const optionalText = (max: number) => z.string().trim().max(max).optional()
export const CompleteUploadBody = z
  .strictObject({
    title: z.string().trim().min(1).max(100),
    gameVersion: z.string().min(1).max(64), // slug of GET /api/game-versions
    // Details of the form (US-11, T-26d), all optional; free texts pass the insult filter on the server
    description: optionalText(1000),
    altText: optionalText(150), // US-75.3
    caption: optionalText(140),
    zone: z.string().min(1).max(64).optional(), // slug of GET /api/zones/suggest
    zoneCustom: z.string().trim().min(2).max(100).optional(), // a zone not in the dictionary (US-11.3)
    inGameTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    graphicsSettings: optionalText(100),
    characterName: optionalText(100),
    tags: z.array(z.string().max(64)).max(10).optional(), // normalised and checked by shared/domain/tags
    // Focal point of the crops (US-13.1), 0–1 from the left and the top; both or neither (none: the centre)
    focalX: z.number().min(0).max(1).optional(),
    focalY: z.number().min(0).max(1).optional(),
  })
  .refine((body) => !(body.zone && body.zoneCustom), { path: ['zoneCustom'], message: 'A zone or a free zone' })
  .refine((body) => (body.focalX === undefined) === (body.focalY === undefined), {
    path: ['focalY'],
    message: 'Both coordinates of the focal point',
  })
export type CompleteUploadBody = z.infer<typeof CompleteUploadBody>

export const CompleteUploadResponse = z.strictObject({ photoId: z.uuid(), status: z.literal('processing') })
export type CompleteUploadResponse = z.infer<typeof CompleteUploadResponse>

/**
 * PATCH /api/photos/{id} (US-12.1, US-13.1): only the fields sent change; an empty text, a `null` zone or focal point
 * clears it; `tags` replaces the list. The game version and the image stay as they are. At least one field.
 */
export const UpdatePhotoBody = z
  .strictObject({
    title: z.string().trim().min(1).max(100).optional(),
    description: optionalText(1000),
    altText: optionalText(150),
    caption: optionalText(140),
    zone: z.string().min(1).max(64).nullable().optional(),
    zoneCustom: z.string().trim().min(2).max(100).nullable().optional(),
    inGameTime: z
      .string()
      .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/)
      .optional(),
    graphicsSettings: optionalText(100),
    characterName: optionalText(100),
    tags: z.array(z.string().max(64)).max(10).optional(),
    focalX: z.number().min(0).max(1).nullable().optional(),
    focalY: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
  .refine((body) => !(body.zone && body.zoneCustom), { path: ['zoneCustom'], message: 'A zone or a free zone' })
  .refine((body) => (body.focalX === undefined) === (body.focalY === undefined), {
    path: ['focalY'],
    message: 'Both coordinates of the focal point',
  })
export type UpdatePhotoBody = z.infer<typeof UpdatePhotoBody>

/** `{id}` of the /api/photos/{id}/… routes. */
export const PhotoParams = z.strictObject({ id: z.uuid() })

/** GET /api/me/photos (« My captures », US-14.4): `cursor` from the previous page. */
export const MyPhotosQuery = z.strictObject({ cursor: z.uuid().optional() })
export const MyPhotosResponse = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.uuid(),
      title: z.string().nullable(),
      status: z.enum(['processing', 'failed', 'pending_review', 'published', 'rejected', 'hidden']),
      width: z.int(),
      height: z.int(),
      uploadedAt: z.iso.datetime(),
    }),
  ),
  nextCursor: z.uuid().nullable(),
})
export type MyPhotosResponse = z.infer<typeof MyPhotosResponse>

/** GET /api/me/photos/{id}: one of the member's captures with its details, for its edit form (US-12.1). */
export const MyPhotoResponse = z.strictObject({
  id: z.uuid(),
  status: z.enum(['processing', 'failed', 'pending_review', 'published', 'rejected', 'hidden']),
  title: z.string().nullable(),
  width: z.int(),
  height: z.int(),
  description: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  zone: z.strictObject({ slug: z.string(), nameEn: z.string(), nameFr: z.string() }).nullable(),
  zoneCustom: z.string().nullable(),
  inGameTime: z.string().nullable(),
  graphicsSettings: z.string().nullable(),
  characterName: z.string().nullable(),
  tags: z.array(z.string()),
  focalX: z.number().nullable(),
  focalY: z.number().nullable(),
})
export type MyPhotoResponse = z.infer<typeof MyPhotoResponse>

/** POST /api/me/avatar-upload-url (US-07.6): the square file declared with UploadUrlBody; PUT it before `expiresAt`. */
export const AvatarUploadUrlResponse = z.strictObject({ version: z.uuid(), url: z.url(), expiresAt: z.iso.datetime() })
export type AvatarUploadUrlResponse = z.infer<typeof AvatarUploadUrlResponse>
/** POST /api/me/avatar/complete: the version put, sent to processing and moderation (204). */
export const AvatarCompleteBody = z.strictObject({ version: z.uuid() })

/**
 * GET /api/photos (US-20.1, US-20.3): a page of a grid, published captures only. `version`: slug of
 * GET /api/game-versions (unknown or archived: 404); `zone`: slug of the dictionary (unknown: 400); `cursor`: the
 * `nextCursor` of the previous page, for the same filters and sort.
 */
export const PhotosQuery = z.strictObject({
  version: z.string().min(1).max(64).optional(),
  zone: z.string().min(1).max(64).optional(),
  timeOfDay: z.enum(TIMES_OF_DAY).optional(),
  minQuality: z.enum(QUALITIES).optional(),
  sort: z.enum(GRID_SORTS).default('recent'),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
})
export type PhotosQuery = z.infer<typeof PhotosQuery>
/** A capture of a grid or of the « More from » block. */
const GridItem = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  width: z.int(),
  height: z.int(),
  author: z.strictObject({ username: z.string() }),
  zone: z.strictObject({ slug: z.string(), nameEn: z.string(), nameFr: z.string() }).nullable(),
  likes: z.int(),
  quality: z.enum(QUALITIES),
  publishedAt: z.iso.datetime(),
})
export const PhotosResponse = z.strictObject({ items: z.array(GridItem), nextCursor: z.string().nullable() })
export type PhotosResponse = z.infer<typeof PhotosResponse>

/**
 * GET /api/photos/{id}/related (US-67.2, US-70.1, US-70.2): the previous (newer) and next (older) captures of its
 * version, and the sections of the « More from » block (4 thumbnails at most, none empty; no section: no block).
 * 404 for a capture that is not public.
 */
export const RelatedResponse = z.strictObject({
  prev: z.uuid().nullable(),
  next: z.uuid().nullable(),
  sections: z.array(
    z.strictObject({ kind: z.enum(['author', 'similar', 'zone', 'latest']), items: z.array(GridItem) }),
  ),
})
export type RelatedResponse = z.infer<typeof RelatedResponse>

/**
 * GET /api/search (US-21, ADR-007): `q` cleaned and cut at 100 characters by the server (US-21.7: never refused for
 * its length up to 2 000, nor for a control character); `version` 404 when unknown or archived; `cursor` the
 * `nextCursor` of the previous page, for the same query and sort.
 */
export const SearchQuery = z.strictObject({
  q: z.string().max(2000),
  version: z.string().min(1).max(64).optional(),
  minQuality: z.enum(QUALITIES).optional(),
  sort: z.enum(['relevance', 'recent', 'popular']).default('relevance'),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
})
export type SearchQuery = z.infer<typeof SearchQuery>
/**
 * The query as searched (`query`, to show it), and a page of captures. `corrected`: the zone or tag name searched
 * instead of a mistyped query that found nothing (US-21.2). `empty`, when nothing is found (US-21.6): close names to
 * suggest, popular tags and the latest captures.
 */
export const SearchResponse = z.strictObject({
  query: z.string(),
  corrected: z.string().nullable(),
  items: z.array(GridItem),
  nextCursor: z.string().nullable(),
  empty: z
    .strictObject({ suggestions: z.array(z.string()), popularTags: z.array(z.string()), latest: z.array(GridItem) })
    .nullable(),
})
export type SearchResponse = z.infer<typeof SearchResponse>

/**
 * GET /api/home (US-24.1, US-24.2, US-70.4): the hero (null: no public capture dark enough, the page shows its
 * gradient), « Capture of the week » with the step that chose it (null: no block), the latest captures of every
 * version. The quest banner comes with the contests (T-64).
 */
export const HomeResponse = z.strictObject({
  hero: z
    .strictObject({
      id: z.uuid(),
      title: z.string(),
      width: z.int(),
      height: z.int(),
      focalX: z.number().min(0).max(1).nullable(),
      focalY: z.number().min(0).max(1).nullable(),
      author: z.strictObject({ username: z.string() }),
    })
    .nullable(),
  week: z.strictObject({ reason: z.enum(['week', 'month', 'all', 'pick']), capture: GridItem }).nullable(),
  latest: z.array(GridItem),
})
export type HomeResponse = z.infer<typeof HomeResponse>

const Names = z.strictObject({ slug: z.string(), nameEn: z.string(), nameFr: z.string() })

/**
 * GET /api/photos/{id} (US-25.1, PDP): a published capture with its details, 404 otherwise (annexe B). Free text of
 * the author as given (rendered as text); the counters raw, the page hides those under 10 (US-70.6).
 */
export const PhotoResponse = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.int(),
  height: z.int(),
  mime: z.string(),
  bytes: z.int(),
  version: Names,
  zone: Names.nullable(),
  inGameTime: z.string().nullable(),
  graphicsSettings: z.string().nullable(),
  characterName: z.string().nullable(),
  tags: z.array(z.string()),
  author: z.strictObject({ username: z.string(), avatarUrl: AvatarUrl }),
  likes: z.int(),
  downloads: z.int(),
  quality: z.enum(QUALITIES),
  publishedAt: z.iso.datetime(),
})
export type PhotoResponse = z.infer<typeof PhotoResponse>
