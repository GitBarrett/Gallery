import { GRID_SORTS, type GridSort } from '~~/shared/domain/grid-sort'
import { QUALITIES, type Quality } from '~~/shared/domain/quality'
import { TIMES_OF_DAY, type TimeOfDay } from '~~/shared/domain/time-of-day'

/** Filters of a PLP (US-20.3), held by its URL only: shared links and the back button give the same grid. */
export interface GalleryFilters {
  zone?: string // slug of the dictionary
  timeOfDay?: TimeOfDay
  minQuality?: Quality
  sort?: GridSort
}

const one = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const pick = <T extends string>(allowed: readonly T[], value: unknown): T | undefined => {
  const text = one(value)
  return allowed.includes(text as T) ? (text as T) : undefined
}

/** The filters of a query string; an unknown value is left out, as if absent. Poor and Most recent are the defaults. */
export function readFilters(query: Record<string, unknown>): GalleryFilters {
  const zone = one(query.zone)
  const minQuality = pick(QUALITIES, query.quality)
  const sort = pick(GRID_SORTS, query.sort)
  return {
    zone: typeof zone === 'string' && /^[a-z0-9-]{1,64}$/.test(zone) ? zone : undefined,
    timeOfDay: pick(TIMES_OF_DAY, query.time),
    minQuality: minQuality === 'poor' ? undefined : minQuality,
    sort: sort === 'recent' ? undefined : sort,
  }
}

/** The query string of filters, defaults left out (`/v/wow-forever` rather than `?sort=recent`). */
export function writeFilters(filters: GalleryFilters): Record<string, string> {
  const query: Record<string, string> = {}
  if (filters.zone) query.zone = filters.zone
  if (filters.timeOfDay) query.time = filters.timeOfDay
  if (filters.minQuality && filters.minQuality !== 'poor') query.quality = filters.minQuality
  if (filters.sort && filters.sort !== 'recent') query.sort = filters.sort
  return query
}
