import type { QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { decodeCursor } from '../domain/cursor'
import {
  cursorAfter,
  GRID_PAGE,
  toGridCapture,
  type GalleryError,
  type GalleryRepository,
  type GridCapture,
} from './grid'

/**
 * The captures of a profile (US-05.3; public read, annexe B): its public captures only (the rule of the grids: never
 * in review nor hidden), newest first, by pages; an unknown, banned or leaving account has none (its page is a 404).
 */
export const authorCaptures =
  (deps: { repo: GalleryRepository; thresholds: () => Promise<QualityThresholds> }) =>
  async (query: {
    username: string
    cursor?: string
    limit?: number
  }): Promise<Result<{ items: GridCapture[]; nextCursor: string | null }, GalleryError>> => {
    const after = query.cursor ? decodeCursor('recent', query.cursor) : undefined
    if (after === null) return err({ kind: 'invalid', field: 'cursor', reason: 'unknown' })
    const thresholds = await deps.thresholds()
    const limit = query.limit ?? GRID_PAGE
    const rows = await deps.repo.grid({
      authorUsername: query.username,
      minLikes: 0,
      sort: 'recent',
      after,
      limit: limit + 1,
    })
    const page = rows.slice(0, limit)
    return ok({
      items: page.map(toGridCapture(thresholds)),
      nextCursor: rows.length > limit ? cursorAfter('recent', page.at(-1)!) : null,
    })
  }
