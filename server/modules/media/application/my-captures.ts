import { err, ok } from '../../../../shared/domain/result'
import type { MediaRepository, OwnCapture } from './ports'

/** Page of « My captures » (03 § API: cursor pages of 60 at most). */
export const MY_CAPTURES_PAGE = 30

/**
 * The member's own captures, every status once uploaded, latest first (US-14.4): only the actor's, so no policy
 * beyond the session. `nextCursor`: the last id when more remain.
 */
export const listMyCaptures =
  (deps: { repo: MediaRepository }) =>
  async (cmd: { userId: string; cursor?: string }): Promise<{ items: OwnCapture[]; nextCursor: string | null }> => {
    const rows = await deps.repo.listOwn(cmd.userId, { before: cmd.cursor, limit: MY_CAPTURES_PAGE + 1 })
    const items = rows.slice(0, MY_CAPTURES_PAGE)
    return { items, nextCursor: rows.length > MY_CAPTURES_PAGE ? items.at(-1)!.id : null }
  }

/**
 * One of the member's captures with its details, for its edit form (US-12.1): the author only, anyone else (or a
 * capture not completed) is not found. Zone and tags named by the catalogue.
 */
export const getMyCapture =
  (deps: {
    repo: MediaRepository
    zoneById: (id: string) => Promise<{ slug: string; nameEn: string; nameFr: string } | null>
    tagSlugs: (ids: string[]) => Promise<string[]>
  }) =>
  async (cmd: { userId: string; photoId: string }) => {
    const found = await deps.repo.findDetails(cmd.photoId)
    if (!found || found.userId !== cmd.userId) return err({ kind: 'not_found' } as const)
    const { userId: _, zoneId, tagIds, ...details } = found
    return ok({ ...details, zone: zoneId ? await deps.zoneById(zoneId) : null, tags: await deps.tagSlugs(tagIds) })
  }
