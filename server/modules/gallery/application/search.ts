import { minLikes, type Quality, type QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { MIN_QUERY, normalizeQuery, tagCandidates } from '../../../../shared/domain/search'
import { decodeCursor, decodeOffset, encodeCursor, encodeOffset } from '../domain/cursor'
import {
  GRID_PAGE,
  toGridCapture,
  type GalleryError,
  type GalleryRepository,
  type GridCapture,
  type GridFilter,
} from './grid'

export const SEARCH_SORTS = ['relevance', 'recent', 'popular'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

type Deps = {
  repo: GalleryRepository
  gameVersions: () => Promise<{ slug: string }[]>
  /** The zone of the dictionary a normalised text names (catalog), null otherwise. */
  zoneByName: (text: string) => Promise<string | null>
  thresholds: () => Promise<QualityThresholds>
}
type Query = { q: string; version?: string; minQuality?: Quality; sort: SearchSort; cursor?: string; limit?: number }
type Page = { query: string; items: GridCapture[]; nextCursor: string | null }

// Relevance pages by offset (a score is no stable key)
async function byRelevance(deps: Deps, cursor: string | undefined, base: GridFilter, limit: number) {
  const offset = cursor ? decodeOffset(cursor) : 0
  if (offset === null) return null
  const rows = await deps.repo.grid({ ...base, relevance: { offset }, limit: limit + 1 })
  return { rows, next: rows.length > limit ? encodeOffset(offset + limit) : null }
}

// The recent and popular sorts page by the keyset of the grids
async function byKeyset(
  deps: Deps,
  sort: 'recent' | 'popular',
  cursor: string | undefined,
  base: GridFilter,
  limit: number,
) {
  const after = cursor ? decodeCursor(sort, cursor) : undefined
  if (after === null) return null
  const rows = await deps.repo.grid({ ...base, sort, after, limit: limit + 1 })
  const last = rows[limit - 1]
  if (rows.length <= limit || !last) return { rows, next: null }
  const key = sort === 'popular' ? last.likes : 0
  return { rows, next: encodeCursor(sort, { key, publishedAt: last.publishedAt, id: last.id }) }
}

const page = (deps: Deps, query: Query, base: GridFilter, limit: number) =>
  query.sort === 'relevance'
    ? byRelevance(deps, query.cursor, base, limit)
    : byKeyset(deps, query.sort, query.cursor, base, limit)

/**
 * A search (US-21.1, US-21.4, US-21.7; public read, annexe B): the query cleaned and cut at 100 characters, then the
 * published captures whose title, description, character or free zone hold its words, or in the zone it names (by EN
 * name, FR name or alias), or tagged with it; by relevance (ADR-007 score), recency or popularity, filtered by version
 * and minimum quality. A query too short gives no result; an unknown or archived version is not found. Typos and the
 * suggestions of an empty search come with T-33c.
 */
export const searchPhotos =
  (deps: Deps) =>
  async (query: Query): Promise<Result<Page, GalleryError>> => {
    const text = normalizeQuery(query.q)
    if (text.length < MIN_QUERY) return ok({ query: text, items: [], nextCursor: null })
    if (query.version && !(await deps.gameVersions()).some((v) => v.slug === query.version))
      return err({ kind: 'not_found' })
    const thresholds = await deps.thresholds()
    const base: GridFilter = {
      gameVersion: query.version,
      minLikes: query.minQuality ? minLikes(query.minQuality, thresholds) : 0,
      sort: 'recent',
      match: { text, zoneId: await deps.zoneByName(text), tags: tagCandidates(text) },
      limit: 0,
    }
    const limit = query.limit ?? GRID_PAGE
    const found = await page(deps, query, base, limit)
    if (!found) return err({ kind: 'invalid', field: 'cursor', reason: 'unknown' })
    const items = found.rows.slice(0, limit).map(toGridCapture(thresholds))
    return ok({ query: text, items, nextCursor: found.next })
  }
