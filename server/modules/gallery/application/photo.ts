import { qualityFromLikes, type Quality, type QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { GalleryError, GridZone } from './grid'

/** A capture of the photo page, as the read view gives it (published, version not archived, author not ended). */
export interface PhotoRow {
  id: string
  title: string
  description: string | null
  altText: string | null
  caption: string | null
  width: number
  height: number
  mime: string
  bytes: number
  version: GridZone // slug and names, like a zone
  zone: GridZone | null
  inGameTime: string | null
  graphicsSettings: string | null
  characterName: string | null
  tags: string[]
  author: { username: string; avatarUrl: string | null }
  likes: number
  downloads: number
  publishedAt: Date
}

/** Port: one capture of the read view of the photo page (10 § Règles, like the grids). */
export interface GalleryPhotos {
  photo(id: string): Promise<PhotoRow | null>
}

/**
 * The photo page of a capture (US-25.1; annexe B, public read): a published capture only, anything else — draft, in
 * review, hidden, rejected, deleted, archived version, banned author — is not found. Its quality from its likes and
 * the thresholds of the settings.
 */
export const viewPhoto =
  (deps: { photos: GalleryPhotos; thresholds: () => Promise<QualityThresholds> }) =>
  async (cmd: { id: string }): Promise<Result<PhotoRow & { quality: Quality }, GalleryError>> => {
    const row = await deps.photos.photo(cmd.id)
    if (!row) return err({ kind: 'not_found' })
    return ok({ ...row, quality: qualityFromLikes(row.likes, await deps.thresholds()) })
  }
