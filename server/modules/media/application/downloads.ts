import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { Actor } from '../../identity'
import { originalKey, type DownloadLog, type MediaRepository, type ObjectStorage } from './ports'
import type { MediaError } from './uploads'

// 08-securite.md § 8: 100 downloads per hour per account (exact counters); every request counts, recorded or not
export const DOWNLOADS_PER_HOUR: RateLimitRule = { name: 'downloads', limit: 100, windowSeconds: 3600 }
/** Life of the presigned URL (03 § Pipeline image 7). */
export const DOWNLOAD_URL_SECONDS = 300
const KEPT_DAYS = 30 // 03 § Cron, legal/privacy.md
const EXTENSIONS: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }

const utcDay = (at: Date) => at.toISOString().slice(0, 10)

/**
 * HD download (US-23.1, US-23.3; annexe B: any member, the visitor gets 401 from the route): the cleaned original of
 * a published capture, through a GET of the private bucket signed for 5 minutes, answered as an attachment of its
 * stored type (08 § 6); counted once per member, capture and UTC day; 100 requests per hour per account. A capture
 * that is not published, or without its original, is not found.
 */
export const requestDownload =
  (deps: {
    repo: MediaRepository
    storage: ObjectStorage
    downloads: DownloadLog
    limiter: RateLimiter
    clock: Clock
  }) =>
  async (cmd: { actor: Actor; photoId: string }): Promise<Result<{ url: string; expiresAt: Date }, MediaError>> => {
    const photo = await deps.repo.findUpload(cmd.photoId)
    if (photo?.status !== 'published') return err({ kind: 'not_found' })
    const original = await deps.storage.head(originalKey(photo.id))
    if (!original) return err({ kind: 'not_found' })
    const limit = await deps.limiter.consume(DOWNLOADS_PER_HOUR, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const now = deps.clock.now()
    await deps.downloads.record(cmd.actor.id, photo.id, utcDay(now))
    const contentType = original.contentType ?? photo.mime
    const url = await deps.storage.presignGet(originalKey(photo.id), {
      contentType,
      filename: `legendary-shots-${photo.id}.${EXTENSIONS[contentType] ?? 'bin'}`,
      expiresInSeconds: DOWNLOAD_URL_SECONDS,
    })
    return ok({ url, expiresAt: new Date(now.getTime() + DOWNLOAD_URL_SECONDS * 1000) })
  }

/** Daily cron (03 § Cron): the downloads of more than 30 days are forgotten; the counters keep them. */
export const purgeDownloads = (deps: { downloads: DownloadLog; clock: Clock }) => (): Promise<number> =>
  deps.downloads.purgeBefore(utcDay(new Date(deps.clock.now().getTime() - KEPT_DAYS * 86_400_000)))
