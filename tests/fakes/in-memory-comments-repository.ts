import type { Clock } from '../../server/platform/clock'
import type { CommentsRepository } from '../../server/modules/social'

type Stored = { id: string; photoId: string; userId: string; body: string; createdAt: Date; editedAt: Date | null }

/**
 * In-memory CommentsRepository for use case tests: `captures` by id with their author and visibility, `accounts` with
 * their creation date; the comments, the counters of the captures.
 */
export function inMemoryCommentsRepository(
  clock: Clock,
  captures: Record<string, { authorId: string; public?: boolean }>,
  accounts: Record<string, Date> = {},
) {
  const comments = new Map<string, Stored>()
  const counts = new Map(Object.keys(captures).map((id) => [id, 0]))
  let n = 0
  const repo: CommentsRepository = {
    async target(photoId) {
      const capture = captures[photoId]
      return capture ? { authorId: capture.authorId, public: capture.public ?? true } : null
    },
    async accountCreatedAt(userId) {
      return accounts[userId] ?? new Date('2026-01-01T00:00:00Z')
    },
    async add({ photoId, userId, body }) {
      const id = `0193a000-0000-7000-8000-${String(++n).padStart(12, '0')}`
      const createdAt = clock.now()
      comments.set(id, { id, photoId, userId, body, createdAt, editedAt: null })
      counts.set(photoId, counts.get(photoId)! + 1)
      return { id, createdAt }
    },
    async find(id) {
      const c = comments.get(id)
      return c
        ? {
            id,
            photoId: c.photoId,
            userId: c.userId,
            photoAuthorId: captures[c.photoId]!.authorId,
            createdAt: c.createdAt,
          }
        : null
    },
    async edit(id, body, at) {
      Object.assign(comments.get(id)!, { body, editedAt: at })
    },
    async remove(id) {
      const c = comments.get(id)
      if (!c) return false
      comments.delete(id)
      counts.set(c.photoId, counts.get(c.photoId)! - 1)
      return true
    },
    async list(photoId, after, limit) {
      return [...comments.values()]
        .filter((c) => c.photoId === photoId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .filter(
          (c) => !after || c.createdAt < after.createdAt || (+c.createdAt === +after.createdAt && c.id < after.id),
        )
        .slice(0, limit)
        .map((c) => ({ ...c, username: `name-of-${c.userId}`, avatarKey: null }))
    },
  }
  return { repo, comments, counts }
}
