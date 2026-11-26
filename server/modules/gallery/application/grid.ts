import { minLikes, qualityFromLikes, type Quality, type QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { TimeOfDay } from '../../../../shared/domain/time-of-day'
import { decodeCursor, encodeCursor, type GridPosition, type GridSort } from '../domain/cursor'

/** A zone of the dictionary, as the catalogue names it. */
export interface GridZone {
  slug: string
  nameEn: string
  nameFr: string
}

/** What the grid query reads: published captures only, in the order of `sort`, after `after`. */
export interface GridFilter {
  gameVersion?: string // slug, not archived
  zoneId?: string
  authorId?: string
  exclude?: string[] // capture ids left out (the page shown, those already picked)
  publishedSince?: Date
  /** A search (US-21, ADR-007): the text, the zone it names, the tags it may name. */
  match?: { text: string; zoneId: string | null; tags: string[] }
  /** Relevance of a search: by score, `offset` results skipped (no keyset: a score is no stable key). */
  relevance?: { offset: number }
  timeOfDay?: TimeOfDay
  minLikes: number
  sort: GridSort
  after?: GridPosition
  limit: number
}

export interface GridRow {
  id: string
  title: string
  width: number
  height: number
  username: string
  zone: GridZone | null
  likes: number
  downloads: number
  publishedAt: Date
}

/** Port: the read view of the grids (10 § Règles: photos, their details, authors, versions and zones). */
export interface GalleryRepository {
  grid(filter: GridFilter): Promise<GridRow[]>
}

export interface GridCapture extends Omit<GridRow, 'downloads' | 'username'> {
  author: { username: string }
  quality: Quality
}

export type GalleryError = { kind: 'not_found' } | { kind: 'invalid'; field: 'cursor' | 'zone'; reason: 'unknown' }

export const GRID_PAGE = 30

const keyOf = (sort: GridSort, row: GridRow) =>
  sort === 'popular' ? row.likes : sort === 'downloads' ? row.downloads : 0

/** A row of the read view as a capture of a grid: its author, its quality from its likes; its downloads stay out. */
export const toGridCapture =
  (thresholds: QualityThresholds) =>
  ({ downloads: _, username, ...row }: GridRow): GridCapture => ({
    ...row,
    author: { username },
    quality: qualityFromLikes(row.likes, thresholds),
  })

/**
 * A page of a grid (US-20.1, US-20.3; open to every visitor, annexe B): the published captures of a version that is
 * not archived (unknown or archived: not found, US-20.4), filtered by zone of the dictionary, time of day and
 * minimum quality (its likes read from the thresholds of the settings), most recent, liked or downloaded first.
 */
export const browseGrid =
  (deps: {
    repo: GalleryRepository
    gameVersions: () => Promise<{ slug: string }[]>
    zoneOf: (slug: string) => Promise<string | null>
    thresholds: () => Promise<QualityThresholds>
  }) =>
  async (query: {
    version?: string
    zone?: string
    timeOfDay?: TimeOfDay
    minQuality?: Quality
    sort: GridSort
    cursor?: string
    limit?: number
  }): Promise<Result<{ items: GridCapture[]; nextCursor: string | null }, GalleryError>> => {
    if (query.version && !(await deps.gameVersions()).some((v) => v.slug === query.version))
      return err({ kind: 'not_found' })
    const after = query.cursor ? decodeCursor(query.sort, query.cursor) : undefined
    if (after === null) return err({ kind: 'invalid', field: 'cursor', reason: 'unknown' })
    const zoneId = query.zone ? await deps.zoneOf(query.zone) : undefined
    if (zoneId === null) return err({ kind: 'invalid', field: 'zone', reason: 'unknown' })
    const thresholds = await deps.thresholds()
    const limit = query.limit ?? GRID_PAGE
    const rows = await deps.repo.grid({
      gameVersion: query.version,
      zoneId,
      timeOfDay: query.timeOfDay,
      minLikes: query.minQuality ? minLikes(query.minQuality, thresholds) : 0,
      sort: query.sort,
      after,
      limit: limit + 1,
    })
    const page = rows.slice(0, limit)
    return ok({
      items: page.map(toGridCapture(thresholds)),
      nextCursor: rows.length > limit ? cursorAfter(query.sort, page.at(-1)!) : null,
    })
  }

const cursorAfter = (sort: GridSort, last: GridRow) =>
  encodeCursor(sort, { key: keyOf(sort, last), publishedAt: last.publishedAt, id: last.id })
