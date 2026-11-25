import { err, ok, type Result } from '../../../../shared/domain/result'
import { notSanctioned, requireVerified, type Actor } from '../../identity'
import { checkDetails, textOrNone, type DetailsInput } from '../domain/capture-details'
import { originalKey, type CachePurger, type DetailsChanges, type MediaRepository, type ObjectStorage } from './ports'
import { removeImages } from './serve-image'
import { moveToTrash } from './trash'
import type { MediaError } from './uploads'

/**
 * The author's own completed capture (08-securite.md annexe B, rows `PATCH` and `DELETE /api/photos/{id}`):
 * another member's is refused, 403 when it is published, 404 otherwise (its existence is not revealed); moderators
 * go through the moderation tools.
 */
async function ownCapture(repo: MediaRepository, actor: Actor, photoId: string) {
  const photo = await repo.findUpload(photoId)
  if (!photo?.uploadedAt) return err({ kind: 'not_found' } as const)
  if (photo.userId !== actor.id)
    return photo.status === 'published'
      ? err({ kind: 'forbidden', reason: 'owner' } as const)
      : err({ kind: 'not_found' } as const)
  return ok(photo)
}

const cleared = (text: string | undefined) => (text === undefined ? undefined : (textOrNone(text) ?? null))

const mayEdit = (actor: Actor) => {
  const verified = requireVerified(actor)
  return verified.ok ? notSanctioned(actor) : verified
}

/**
 * Edit of a capture (US-12.1, US-13.1): only the fields sent change, the free texts pass the insult filter again,
 * zone and tags are resolved by the catalogue; no new image moderation, the status stays. Verified and active
 * members only (a suspended one may delete, not edit).
 */
export const editCapture =
  (deps: {
    repo: MediaRepository
    zoneOf: (slug: string) => Promise<string | null>
    tagIdsOf: (slugs: string[]) => Promise<string[]>
  }) =>
  async (
    cmd: Partial<Omit<DetailsInput, 'title' | 'zoneCustom'>> & {
      actor: Actor
      photoId: string
      title?: string
      zone?: string | null
      zoneCustom?: string | null
      inGameTime?: string
      focalX?: number | null
      focalY?: number | null
    },
  ): Promise<Result<void, MediaError>> => {
    const allowed = mayEdit(cmd.actor)
    if (!allowed.ok) return allowed
    const own = await ownCapture(deps.repo, cmd.actor, cmd.photoId)
    if (!own.ok) return own
    const checked = checkDetails({ ...cmd, title: cmd.title ?? '', zoneCustom: cmd.zoneCustom ?? undefined })
    if (!checked.ok) return err({ kind: 'invalid', ...checked.error })
    // undefined: unchanged; null: cleared; a slug of the dictionary: its id, or refused
    const zoneId = cmd.zone ? await deps.zoneOf(cmd.zone) : cmd.zone
    if (cmd.zone && zoneId === null) return err({ kind: 'invalid', field: 'zone', reason: 'unknown' })
    await deps.repo.updateDetails(cmd.photoId, {
      ...changesOf(cmd),
      metadata: zoneChanges(cmd, zoneId),
      ...(cmd.tags && { tagIds: await deps.tagIdsOf(checked.value.tags) }),
    })
    return ok(undefined)
  }

function changesOf(cmd: Parameters<ReturnType<typeof editCapture>>[0]): Omit<DetailsChanges, 'metadata' | 'tagIds'> {
  const changes: Omit<DetailsChanges, 'metadata' | 'tagIds'> = {
    title: cmd.title,
    description: cleared(cmd.description),
    altText: cleared(cmd.altText),
    focalX: cmd.focalX,
    focalY: cmd.focalY,
  }
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
}

// A zone of the dictionary replaces a free one and the other way round; `null` clears both
function zoneChanges(cmd: Parameters<ReturnType<typeof editCapture>>[0], zoneId: string | null | undefined) {
  const metadata: DetailsChanges['metadata'] = {
    caption: cleared(cmd.caption),
    inGameTime: cmd.inGameTime === undefined ? undefined : cmd.inGameTime || null,
    graphicsSettings: cleared(cmd.graphicsSettings),
    characterName: cleared(cmd.characterName),
  }
  if (zoneId !== undefined || cmd.zoneCustom !== undefined) {
    metadata.zoneId = zoneId ?? null
    metadata.zoneCustom = cmd.zoneCustom ? textOrNone(cmd.zoneCustom) : null
  }
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
}

/**
 * Deletion of a capture (US-12.2): its cleaned original and its variants move to `trash/` (30 days, restore
 * runbook), the 5 public addresses are purged from the edge cache, then the row goes with its details and tags.
 * A suspended author may delete. A capture still processing waits (409): its variants are being written.
 * shortcut: collections and contest entries do not exist yet; T-61 and T-64 remove them with the capture (US-12.4)
 */
export const deleteCapture =
  (deps: { repo: MediaRepository; storage: ObjectStorage; purger: CachePurger; siteUrl: string }) =>
  async (cmd: { actor: Actor; photoId: string }): Promise<Result<void, MediaError>> => {
    const verified = requireVerified(cmd.actor)
    if (!verified.ok) return verified
    const own = await ownCapture(deps.repo, cmd.actor, cmd.photoId)
    if (!own.ok) return own
    if (own.value.status === 'processing') return err({ kind: 'busy' })
    // Objects first: a failure leaves the capture in place, the member deletes it again
    await moveToTrash(deps.storage, originalKey(cmd.photoId))
    await removeImages(deps)(cmd.photoId)
    await deps.repo.deleteCapture(cmd.photoId)
    return ok(undefined)
  }
