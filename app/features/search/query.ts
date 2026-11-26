import { QUALITIES, type Quality } from '~~/shared/domain/quality'

export const SEARCH_SORTS = ['relevance', 'recent', 'popular'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

/** A search (US-21), held by its URL only: shared links and the back button give the same results. */
export interface Search {
  q: string
  version?: string // slug
  minQuality?: Quality
  sort?: SearchSort
}

const one = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const pick = <T extends string>(allowed: readonly T[], value: unknown): T | undefined =>
  allowed.includes(one(value) as T) ? (one(value) as T) : undefined

/** The search of a query string; an unknown value is left out. Poor and Relevance are the defaults. */
export function readSearch(query: Record<string, unknown>): Search {
  const q = one(query.q)
  const version = one(query.version)
  const minQuality = pick(QUALITIES, query.quality)
  const sort = pick(SEARCH_SORTS, query.sort)
  return {
    q: typeof q === 'string' ? q : '',
    version: typeof version === 'string' && /^[a-z0-9-]{1,64}$/.test(version) ? version : undefined,
    minQuality: minQuality === 'poor' ? undefined : minQuality,
    sort: sort === 'relevance' ? undefined : sort,
  }
}

/** The query string of a search, defaults and an empty text left out. */
export function writeSearch(search: Search): Record<string, string> {
  const query: Record<string, string> = {}
  if (search.q.trim()) query.q = search.q.trim()
  if (search.version) query.version = search.version
  if (search.minQuality && search.minQuality !== 'poor') query.quality = search.minQuality
  if (search.sort && search.sort !== 'relevance') query.sort = search.sort
  return query
}
