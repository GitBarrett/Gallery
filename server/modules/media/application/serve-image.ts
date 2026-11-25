import { err, ok, type Result } from '../../../../shared/domain/result'
import { requireOwner, requireRole, type Actor } from '../../identity'
import { variantKey, type CachePurger, type MediaRepository, type ObjectStorage } from './ports'
import { moveToTrash, trashKey } from './trash'

/** The only served sizes (03 § Pipeline image 6, ADR-012): the stored WebP widths and the og:image JPEG. */
export const IMAGE_SIZES: Record<string, string> = {
  '400': '400.webp',
  '800': '800.webp',
  '1200': '1200.webp',
  '2400': '2400.webp',
  'og.jpg': '1200.jpg',
}

export interface ServedImage {
  body: ReadableStream<Uint8Array>
  contentType: 'image/webp' | 'image/jpeg'
  /** Published: cached a month by browsers and the edge; otherwise a private preview, never stored. */
  public: boolean
}

type Viewer = Pick<Actor, 'id' | 'role' | 'mfaVerified'>
// Private preview (08-securite.md annexe B, row « Capture non publiée »): the author, or a moderator past the TOTP
const canPreview = (viewer: Viewer | null, ownerId: string) =>
  viewer !== null && (requireOwner(viewer, ownerId).ok || requireRole(viewer, 'moderator').ok)

/**
 * A stored variant of a capture as is, never transformed (ADR-012, US-14.6). A published capture is open to all;
 * another status only with `?preview=1` to its author and the moderators (US-14.4). Any other size, capture or viewer:
 * not found, so the existence of a private capture is not revealed. A hidden capture is read from `trash/`.
 */
export const serveImage =
  (deps: { repo: MediaRepository; storage: ObjectStorage }) =>
  async (cmd: {
    photoId: string
    size: string
    preview: boolean
    viewer: Viewer | null
  }): Promise<Result<ServedImage, { kind: 'not_found' }>> => {
    const name = Object.hasOwn(IMAGE_SIZES, cmd.size) ? IMAGE_SIZES[cmd.size]! : null
    const photo = name ? await deps.repo.findUpload(cmd.photoId) : null
    if (!name || !photo) return err({ kind: 'not_found' })
    const published = photo.status === 'published'
    if (!published && !(cmd.preview && canPreview(cmd.viewer, photo.userId))) return err({ kind: 'not_found' })
    const body = await readVariant(deps.storage, variantKey(photo.id, name), photo.status === 'hidden')
    if (!body) return err({ kind: 'not_found' })
    return ok({ body, contentType: name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp', public: published })
  }

const readVariant = async (storage: ObjectStorage, key: string, hidden: boolean) =>
  (await storage.read(key)) ?? (hidden ? await storage.read(trashKey(key)) : null)

/**
 * Images of a hidden or deleted capture (03 § Pipeline image 6): its variants move to `trash/` and the 5 public
 * addresses are purged from the edge cache. Browsers may keep their copy up to its 30 days (immutable).
 */
export const removeImages =
  (deps: { storage: ObjectStorage; purger: CachePurger; siteUrl: string }) =>
  async (photoId: string): Promise<void> => {
    for (const name of new Set(Object.values(IMAGE_SIZES))) await moveToTrash(deps.storage, variantKey(photoId, name))
    await deps.purger.purge(Object.keys(IMAGE_SIZES).map((size) => `${deps.siteUrl}/img/${photoId}/${size}`))
  }
