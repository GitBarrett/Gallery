import type { QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { toGridCapture, type GalleryError, type GalleryRepository, type GridCapture, type GridFilter } from './grid'

/** What the navigation of a photo page needs to know about the capture shown (published only). */
export interface PhotoContext {
  id: string
  userId: string
  zoneId: string | null
  gameVersion: string // slug
  publishedAt: Date
}

/** Port: the place of a capture in the read view (10 § Règles, like the grids). */
export interface GalleryRelated {
  context(id: string): Promise<PhotoContext | null>
  /** The captures just before and after it in the grid of its version, newest first: `prev` newer, `next` older. */
  neighbours(context: PhotoContext): Promise<{ prev: string | null; next: string | null }>
}

export type RelatedKind = 'author' | 'similar' | 'zone' | 'latest'
export interface RelatedSection {
  kind: RelatedKind
  items: GridCapture[]
}

/** Thumbnails of the « More from » block (Photo mockup: 2 × 2). */
export const RELATED_SIZE = 4

type Pick = (filter: Partial<GridFilter>, exclude: string[], limit: number) => ReturnType<GalleryRepository['grid']>

// 07 § Aucun bloc vide: 2 others or more, the author's; 1, it and similar captures (same zone, then same version)
// up to 4 (US-70.1); none, the same zone, else the latest of the version (US-70.2); nothing, no block.
async function block(pick: Pick, c: PhotoContext) {
  const author = await pick({ authorId: c.userId }, [c.id], RELATED_SIZE)
  if (author.length >= 2) return [{ kind: 'author' as const, rows: author }]
  if (author.length === 1) {
    const similar = await alike(pick, c, [c.id, author[0]!.id], RELATED_SIZE - 1)
    return [
      { kind: 'author' as const, rows: author },
      { kind: 'similar' as const, rows: similar },
    ]
  }
  const zone = c.zoneId ? await pick({ zoneId: c.zoneId }, [c.id], RELATED_SIZE) : []
  if (zone.length) return [{ kind: 'zone' as const, rows: zone }]
  return [{ kind: 'latest' as const, rows: await pick({ gameVersion: c.gameVersion }, [c.id], RELATED_SIZE) }]
}

// Same zone first (a capture without a zone of the dictionary skips it), then the same version
async function alike(pick: Pick, c: PhotoContext, seen: string[], limit: number) {
  const zone = c.zoneId ? await pick({ zoneId: c.zoneId }, seen, limit) : []
  if (zone.length >= limit) return zone
  const version = await pick({ gameVersion: c.gameVersion }, [...seen, ...zone.map((r) => r.id)], limit - zone.length)
  return [...zone, ...version]
}

/**
 * Navigation of a photo page (US-67.2, US-70.1, US-70.2; public read, annexe B): the previous and next captures of its
 * version, and the « More from » block with its fallbacks, never an empty section. Not found for a capture that is
 * not public.
 */
export const relatedPhotos =
  (deps: { repo: GalleryRepository; related: GalleryRelated; thresholds: () => Promise<QualityThresholds> }) =>
  async (cmd: {
    id: string
  }): Promise<Result<{ prev: string | null; next: string | null; sections: RelatedSection[] }, GalleryError>> => {
    const context = await deps.related.context(cmd.id)
    if (!context) return err({ kind: 'not_found' })
    const pick: Pick = (filter, exclude, limit) =>
      deps.repo.grid({ minLikes: 0, sort: 'recent', ...filter, exclude, limit })
    const capture = toGridCapture(await deps.thresholds())
    const sections = (await block(pick, context))
      .filter((s) => s.rows.length > 0)
      .map((s) => ({ kind: s.kind, items: s.rows.map(capture) }))
    return ok({ ...(await deps.related.neighbours(context)), sections })
  }
