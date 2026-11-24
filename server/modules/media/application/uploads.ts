import { MAX_CAPTURE_BYTES, validateCaptureFile, type CaptureFile } from '../../../../shared/domain/capture-file'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { notSanctioned, requireVerified, type Actor, type PolicyDenial } from '../../identity'
import { incomingKey, type MediaRepository, type ObjectStorage, type Upload } from './ports'

// 08-securite.md § 8: 20 uploads per 24 h per account (exact counters), 3 at the same time
export const UPLOADS_PER_DAY: RateLimitRule = { name: 'uploads', limit: 20, windowSeconds: 86_400 }
export const CONCURRENT_UPLOADS = 3
/** Life of the presigned URL (03 § Pipeline image 2): an upload not put within it can no longer be. */
export const UPLOAD_URL_SECONDS = 600
const ORPHAN_MS = 86_400_000 // US-10.7
const ORPHANS_PER_RUN = 100

export type MediaError =
  | PolicyDenial
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'too_large' }
  | { kind: 'invalid'; field: string; reason: string }
  /** The object in the bucket is missing or differs from what was declared (US-10.6). */
  | { kind: 'mismatch'; reason: 'missing' | 'size' | 'type' }

const mayPost = (actor: Actor): Result<void, PolicyDenial> => {
  const verified = requireVerified(actor)
  return verified.ok ? notSanctioned(actor) : verified
}

/**
 * Upload request (US-10.1, annexe B): a verified member who is not sanctioned, within the quotas, declares the file;
 * the server checks it again (US-10.2), creates the capture `processing` and gives a URL of the private bucket,
 * signed on the declared size and type, valid 10 minutes.
 */
export const requestUploadUrl =
  (deps: { repo: MediaRepository; storage: ObjectStorage; limiter: RateLimiter; ids: IdGenerator; clock: Clock }) =>
  async (cmd: {
    actor: Actor
    file: CaptureFile
  }): Promise<Result<{ photoId: string; url: string; expiresAt: Date }, MediaError>> => {
    const allowed = mayPost(cmd.actor)
    if (!allowed.ok) return allowed
    const file = validateCaptureFile(cmd.file)
    if (!file.ok) return err(file.error === 'too_large' ? { kind: 'too_large' } : invalid(file.error))
    const now = deps.clock.now()
    // The concurrent uploads free themselves when their URL expires, 10 min at most
    if (
      (await deps.repo.countIncomplete(cmd.actor.id, new Date(now.getTime() - UPLOAD_URL_SECONDS * 1000))) >=
      CONCURRENT_UPLOADS
    )
      return err({ kind: 'rate_limited', retryAfterSeconds: UPLOAD_URL_SECONDS })
    const limit = await deps.limiter.consume(UPLOADS_PER_DAY, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const photoId = deps.ids.next()
    const { bytes, width, height } = cmd.file
    await deps.repo.createUpload({ id: photoId, userId: cmd.actor.id, mime: file.value, bytes, width, height })
    const url = await deps.storage.presignPut(incomingKey(photoId), {
      contentType: file.value,
      bytes,
      expiresInSeconds: UPLOAD_URL_SECONDS,
    })
    return ok({ photoId, url, expiresAt: new Date(now.getTime() + UPLOAD_URL_SECONDS * 1000) })
  }

const invalid = (reason: string): MediaError => ({ kind: 'invalid', field: 'file', reason })

/**
 * End of an upload (US-10.1, US-10.6): the author's capture still incomplete gets its title and version once the
 * object is in the bucket with the declared size and type; otherwise the object is deleted (422). Then the capture
 * goes to processing (`photo-process`). Idempotent: a capture already completed answers the same, sent once.
 */
export const completeUpload =
  (deps: {
    repo: MediaRepository
    uow: UnitOfWork<MediaRepository>
    storage: ObjectStorage
    gameVersions: () => Promise<{ slug: string }[]>
    clock: Clock
  }) =>
  async (cmd: {
    actor: Actor
    photoId: string
    title: string
    gameVersion: string
  }): Promise<Result<{ photoId: string; status: 'processing' }, MediaError>> => {
    const allowed = mayPost(cmd.actor)
    if (!allowed.ok) return allowed
    const upload = await deps.repo.findUpload(cmd.photoId)
    // Another member's capture is not revealed (08-securite.md § 4)
    if (!upload || upload.userId !== cmd.actor.id) return err({ kind: 'not_found' })
    const done = ok({ photoId: upload.id, status: 'processing' as const })
    if (upload.uploadedAt) return done
    if (!(await deps.gameVersions()).some((v) => v.slug === cmd.gameVersion))
      return err({ kind: 'invalid', field: 'gameVersion', reason: 'unknown' })
    const reason = await checkStored(deps.storage, upload)
    if (reason) return err({ kind: 'mismatch', reason })
    await deps.uow.run(async (repo, publish) => {
      const { title, gameVersion } = cmd
      const completed = await repo.complete(upload.id, { title, gameVersion, at: deps.clock.now() })
      if (completed) publish({ topic: 'photo-process', payload: { kind: 'capture', photoId: upload.id } })
    })
    return done
  }

/**
 * Defence in depth (03 § Pipeline image 4): the signature of Content-Length is not relied upon alone. An object of
 * another size or type than declared is deleted.
 */
async function checkStored(storage: ObjectStorage, upload: Upload): Promise<'missing' | 'size' | 'type' | null> {
  const key = incomingKey(upload.id)
  const stored = await storage.head(key)
  if (!stored) return 'missing'
  const sizeDiffers = stored.bytes !== upload.bytes || stored.bytes > MAX_CAPTURE_BYTES
  const reason = sizeDiffers ? 'size' : stored.contentType === upload.mime ? null : 'type'
  if (reason) await storage.delete(key)
  return reason
}

/**
 * Hourly cron (US-10.7): uploads never completed after 24 h lose their object, then their capture. Idempotent: an
 * interrupted run leaves rows whose object is already gone, deleted at the next one.
 */
export const purgeOrphanUploads =
  (deps: { repo: MediaRepository; storage: ObjectStorage; clock: Clock }) => async (): Promise<number> => {
    const ids = await deps.repo.incompleteBefore(new Date(deps.clock.now().getTime() - ORPHAN_MS), ORPHANS_PER_RUN)
    for (const id of ids) {
      await deps.storage.delete(incomingKey(id))
      await deps.repo.deleteIncomplete(id)
    }
    return ids.length
  }
