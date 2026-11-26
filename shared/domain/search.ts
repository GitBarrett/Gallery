import { normalizeTag } from './tags'

// Search queries (US-21, ADR-007): what the visitor types, cleaned before it reaches the database.

/** Longest query kept (US-21.7): a longer one is cut, never refused. */
export const MAX_QUERY = 100
/** Shortest query searched: below, an empty result rather than every capture. */
export const MIN_QUERY = 2

/**
 * The query as searched (US-21.7): control characters removed, then lower case without accents and with single
 * spaces (normalizeTag: the form of the tags and of the zone names), cut at 100 characters.
 */
export const normalizeQuery = (raw: string) =>
  normalizeTag(raw.replace(/\p{Cc}/gu, ' '))
    .slice(0, MAX_QUERY)
    .trim()

/** Tags the query may name (exact `tags.slug`, ADR-007): the whole query, and each of its words. */
export const tagCandidates = (query: string) => [...new Set([query, ...query.split(' ')])].filter((t) => t.length >= 2)
