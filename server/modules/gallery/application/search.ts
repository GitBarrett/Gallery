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
/** What an empty search offers (US-21.6): close names, popular tags, latest captures. */
export const SEARCH_SUGGESTIONS = 3
export const SEARCH_TAGS = 8
export const SEARCH_LATEST = 12

export interface GallerySearch {
  /** The tags of the most public captures, most used first, then by slug. */
  popularTags(limit: number): Promise<string[]>
}

type Deps = {
  repo: GalleryRepository
  gameVersions: () => Promise<{ slug: string }[]>
  /** The zone of the dictionary a normalised text names (catalog), null otherwise. */
  zoneByName: (text: string) => Promise<string | null>
  /** Names of zones and tags close to a normalised text, closest first (catalog). */
  closestNames: (text: string, limit: number) => Promise<string[]>
  popularTags: GallerySearch['popularTags']
  thresholds: () => Promise<QualityThresholds>
}
type Query = { q: string; version?: string; minQuality?: Quality; sort: SearchSort; cursor?: string; limit?: number }
type Page = {
  query: string
  corrected: string | null
  items: GridCapture[]
  nextCursor: string | null
  empty: { suggestions: string[]; popularTags: string[]; latest: GridCapture[] } | null
}

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

// A page of the captures matching `text`: its zone and tags looked up, then the sort and cursor of the query
async function pageOf(deps: Deps, query: Query, text: string, thresholds: QualityThresholds) {
  const base: GridFilter = {
    gameVersion: query.version,
    minLikes: query.minQuality ? minLikes(query.minQuality, thresholds) : 0,
    sort: 'recent',
    match: { text, zoneId: await deps.zoneByName(text), tags: tagCandidates(text) },
    limit: 0,
  }
  const limit = query.limit ?? GRID_PAGE
  const found = await page(deps, query, base, limit)
  return found && { items: found.rows.slice(0, limit).map(toGridCapture(thresholds)), nextCursor: found.next }
}

// Nothing found (US-21.6, 07 § Aucun bloc vide): the names close to the query, the popular tags, the latest captures
async function emptyOf(deps: Deps, names: string[], thresholds: QualityThresholds) {
  const latest = await deps.repo.grid({ sort: 'recent', minLikes: 0, limit: SEARCH_LATEST })
  return {
    suggestions: names,
    popularTags: await deps.popularTags(SEARCH_TAGS),
    latest: latest.map(toGridCapture(thresholds)),
  }
}

/**
 * A search (US-21; public read, annexe B): the query cleaned and cut at 100 characters, then the published captures
 * whose title, description, character or free zone hold its words, or in the zone it names (by EN name, FR name or
 * alias), or tagged with it; by relevance (ADR-007 score), recency or popularity, filtered by version and minimum
 * quality. Nothing on the first page: the closest zone or tag name (a typo, US-21.2) is searched instead and given as
 * `corrected`; still nothing: `empty` holds what to offer (US-21.6). A query too short gives no result; an unknown or
 * archived version is not found.
 */
export const searchPhotos =
  (deps: Deps) =>
  async (query: Query): Promise<Result<Page, GalleryError>> => {
    const text = normalizeQuery(query.q)
    if (text.length < MIN_QUERY) return ok({ query: text, corrected: null, items: [], nextCursor: null, empty: null })
    if (query.version && !(await deps.gameVersions()).some((v) => v.slug === query.version))
      return err({ kind: 'not_found' })
    const thresholds = await deps.thresholds()
    const found = await pageOf(deps, query, text, thresholds)
    if (!found) return err({ kind: 'invalid', field: 'cursor', reason: 'unknown' })
    if (found.items.length || query.cursor) return ok({ query: text, corrected: null, ...found, empty: null })
    return ok(await fallback(deps, query, text, thresholds))
  }

// A typo (US-21.2): the closest zone or tag name other than the query, searched instead when it finds captures;
// otherwise the empty payload with these names as suggestions
async function fallback(deps: Deps, query: Query, text: string, thresholds: QualityThresholds): Promise<Page> {
  const names = await deps.closestNames(text, SEARCH_SUGGESTIONS)
  const name = names.find((n) => normalizeQuery(n) !== text)
  const retried = name ? await pageOf(deps, query, normalizeQuery(name), thresholds) : null
  if (name && retried?.items.length) return { query: text, corrected: name, ...retried, empty: null }
  return { query: text, corrected: null, items: [], nextCursor: null, empty: await emptyOf(deps, names, thresholds) }
}
