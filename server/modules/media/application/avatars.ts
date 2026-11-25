import { AVATAR_SIZES, avatarPath, MAX_AVATAR_BYTES, validateAvatarFile } from '../../../../shared/domain/avatar-file'
import { isCaptureType, type CaptureFile } from '../../../../shared/domain/capture-file'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { DomainEvent, UnitOfWork } from '../../../platform/unit-of-work'
import { notSanctioned, requireVerified, type Actor } from '../../identity'
import { sniffType, SNIFF_BYTES } from '../domain/file-type'
import type { CachePurger, ImageService, ModerationGateway, ObjectStorage } from './ports'
import { UPLOAD_URL_SECONDS, type MediaError } from './uploads'

// Avatars (US-07.6, 03 § Pipeline image): the same pipeline as the captures, a version per new avatar, written as
// three square WebP once (ADR-012), moderated; the avatar shown stays until the new one is published.

/** Port: the avatar versions of an account, held by identity (users.avatar_key, avatar_pending_key). */
export interface AvatarAccounts {
  findAvatar(userId: string): Promise<{ current: string | null; pending: string | null } | null>
  setPendingAvatar(userId: string, version: string): Promise<void>
  promoteAvatar(userId: string, version: string): Promise<{ previous: string | null } | false>
  dropPendingAvatar(userId: string, version: string): Promise<boolean>
}

// shortcut: 10 new avatars a day per account (no row in 08 § 8); revisit with the moderation load (Q80)
export const AVATARS_PER_DAY: RateLimitRule = { name: 'avatars', limit: 10, windowSeconds: 86_400 }

export const avatarIncomingKey = (userId: string, version: string) => `incoming/avatars/${userId}/${version}`
export const avatarKey = (userId: string, version: string, size: number) => `avatars/${userId}/${version}/${size}.webp`

const mayPost = (actor: Actor) => {
  const verified = requireVerified(actor)
  return verified.ok ? notSanctioned(actor) : verified
}
const notifyAuthor = (
  userId: string,
  outcome: 'published' | 'pending_review' | 'rejected' | 'failed',
): DomainEvent => ({
  topic: 'notifications',
  payload: { type: 'moderation', userId, outcome }, // no photoId: the avatar (notifications consumer)
})

/**
 * Upload request of an avatar (US-07.6, annexe B): a verified, active member declares a square file of 2 MB at most;
 * a new version waits as pending and gets a presigned PUT of 10 minutes.
 */
export const requestAvatarUpload =
  (deps: { accounts: AvatarAccounts; storage: ObjectStorage; limiter: RateLimiter; ids: IdGenerator; clock: Clock }) =>
  async (cmd: {
    actor: Actor
    file: CaptureFile
  }): Promise<Result<{ version: string; url: string; expiresAt: Date }, MediaError>> => {
    const allowed = mayPost(cmd.actor)
    if (!allowed.ok) return allowed
    const file = validateAvatarFile(cmd.file)
    if (!file.ok)
      return err(
        file.error === 'too_large' ? { kind: 'too_large' } : { kind: 'invalid', field: 'file', reason: file.error },
      )
    const limit = await deps.limiter.consume(AVATARS_PER_DAY, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const version = deps.ids.next()
    await deps.accounts.setPendingAvatar(cmd.actor.id, version)
    const url = await deps.storage.presignPut(avatarIncomingKey(cmd.actor.id, version), {
      contentType: file.value,
      bytes: cmd.file.bytes,
      expiresInSeconds: UPLOAD_URL_SECONDS,
    })
    return ok({ version, url, expiresAt: new Date(deps.clock.now().getTime() + UPLOAD_URL_SECONDS * 1000) })
  }

/**
 * End of an avatar upload: the pending version only, once its object is in the bucket with an allowed type and
 * size (otherwise deleted, 422); then `avatar-process` on the photo-process queue. Idempotent.
 */
export const completeAvatarUpload =
  (deps: { accounts: AvatarAccounts; uow: UnitOfWork<unknown>; storage: ObjectStorage }) =>
  async (cmd: { actor: Actor; version: string }): Promise<Result<void, MediaError>> => {
    const allowed = mayPost(cmd.actor)
    if (!allowed.ok) return allowed
    if ((await deps.accounts.findAvatar(cmd.actor.id))?.pending !== cmd.version) return err({ kind: 'not_found' })
    const key = avatarIncomingKey(cmd.actor.id, cmd.version)
    const stored = await deps.storage.head(key)
    if (!stored) return err({ kind: 'mismatch', reason: 'missing' })
    const reason = stored.bytes > MAX_AVATAR_BYTES ? 'size' : isCaptureType(stored.contentType ?? '') ? null : 'type'
    if (reason) {
      await deps.storage.delete(key)
      return err({ kind: 'mismatch', reason })
    }
    await deps.uow.run(async (_, publish) =>
      publish({ topic: 'photo-process', payload: { kind: 'avatar', userId: cmd.actor.id, version: cmd.version } }),
    )
    return ok(undefined)
  }

type ProcessDeps = {
  accounts: AvatarAccounts
  /** Account changes and the author's notification in one transaction (outbox). */
  uow: UnitOfWork<AvatarAccounts>
  storage: ObjectStorage
  images: ImageService
  moderate: ModerationGateway
  purger: CachePurger
  siteUrl: string
}

const urlsOf = (deps: { siteUrl: string }, userId: string, version: string) =>
  AVATAR_SIZES.map((size) => `${deps.siteUrl}${avatarPath(userId, version)}/${size}`)
async function removeVersion(deps: Pick<ProcessDeps, 'storage'>, userId: string, version: string) {
  for (const size of AVATAR_SIZES) await deps.storage.delete(avatarKey(userId, version, size))
}

/**
 * Processing of a pending avatar (`avatar-process`): magic bytes and real dimensions checked (a file that is not a
 * square image ends `failed`), the three WebP written from the upload (re-encoded: no metadata), the 256 px one
 * moderated. Published: it replaces the avatar shown, whose files go and whose addresses are purged. In review: the
 * old one stays shown. Rejected: its files go. The author is notified each time (US-07.6). Idempotent: only a
 * version still pending is processed.
 */
export const processAvatar =
  (deps: ProcessDeps) =>
  async (cmd: { userId: string; version: string }): Promise<'processed' | 'rejected' | 'skipped'> => {
    if ((await deps.accounts.findAvatar(cmd.userId))?.pending !== cmd.version) return 'skipped'
    const source = avatarIncomingKey(cmd.userId, cmd.version)
    if (!(await checkAvatar(deps, source))) {
      await failAvatar(deps)(cmd)
      return 'rejected'
    }
    for (const size of AVATAR_SIZES) {
      const bytes = await deps.images.render((await deps.storage.read(source))!, {
        width: size,
        format: 'image/webp',
        quality: 82,
      })
      await deps.storage.put(avatarKey(cmd.userId, cmd.version, size), bytes, {
        bytes: bytes.length,
        contentType: 'image/webp',
      })
    }
    const image = new Uint8Array(
      await new Response(await deps.storage.read(avatarKey(cmd.userId, cmd.version, 256))).arrayBuffer(),
    )
    const { outcome } = await deps.moderate({ photoId: cmd.version, title: null, image, target: 'avatar' })
    const promoted = await deps.uow.run(async (accounts, publish) => {
      publish(notifyAuthor(cmd.userId, outcome))
      if (outcome === 'published') return accounts.promoteAvatar(cmd.userId, cmd.version)
      if (outcome === 'rejected') await accounts.dropPendingAvatar(cmd.userId, cmd.version)
      return false
    })
    if (promoted && promoted.previous) {
      await removeVersion(deps, cmd.userId, promoted.previous)
      await deps.purger.purge(urlsOf(deps, cmd.userId, promoted.previous))
    }
    if (outcome === 'rejected') await removeVersion(deps, cmd.userId, cmd.version)
    await deps.storage.delete(source)
    return 'processed'
  }

async function checkAvatar(deps: Pick<ProcessDeps, 'storage' | 'images'>, key: string) {
  const stored = await deps.storage.head(key)
  const head = await deps.storage.read(key, SNIFF_BYTES)
  const type = head && sniffType(new Uint8Array(await new Response(head).arrayBuffer()))
  if (!stored || !type) return false
  const info = await deps.images.info((await deps.storage.read(key))!)
  return info.format === type && validateAvatarFile({ contentType: type, bytes: stored.bytes, ...info }).ok
}

/** A pending avatar refused as a file, or whose retries ran out: forgotten, its files gone, the author told. */
export const failAvatar =
  (deps: Pick<ProcessDeps, 'uow' | 'storage'>) =>
  async (cmd: { userId: string; version: string }): Promise<void> => {
    const dropped = await deps.uow.run(async (accounts, publish) => {
      const done = await accounts.dropPendingAvatar(cmd.userId, cmd.version)
      if (done) publish(notifyAuthor(cmd.userId, 'failed'))
      return done
    })
    if (!dropped) return
    await removeVersion(deps, cmd.userId, cmd.version)
    await deps.storage.delete(avatarIncomingKey(cmd.userId, cmd.version))
  }

/** `/avatar/{userId}/{version}/{size}`: the avatar shown only, at 64, 128 or 256 px; anything else not found. */
export const serveAvatar =
  (deps: { accounts: AvatarAccounts; storage: ObjectStorage }) =>
  async (cmd: { userId: string; version: string; size: string }) => {
    const size = AVATAR_SIZES.find((s) => String(s) === cmd.size)
    if (!size || (await deps.accounts.findAvatar(cmd.userId))?.current !== cmd.version) return null
    return deps.storage.read(avatarKey(cmd.userId, cmd.version, size))
  }
