import type { LikesRepository } from '../../server/modules/social'

/** In-memory LikesRepository for use case tests: `captures` by id, their likes and the tier told to their author. */
export function inMemoryLikesRepository(
  captures: Record<string, { authorId: string; public?: boolean; likes?: number }>,
) {
  const likes = new Set<string>()
  const counts = new Map(Object.entries(captures).map(([id, c]) => [id, c.likes ?? 0]))
  const told = new Map<string, number>()
  const repo: LikesRepository = {
    async target(photoId) {
      const capture = captures[photoId]
      return capture ? { authorId: capture.authorId, public: capture.public ?? true } : null
    },
    async add(userId, photoId) {
      const key = `${userId}|${photoId}`
      const changed = !likes.has(key)
      if (changed) {
        likes.add(key)
        counts.set(photoId, counts.get(photoId)! + 1)
      }
      return { changed, likes: counts.get(photoId)! }
    },
    async remove(userId, photoId) {
      const changed = likes.delete(`${userId}|${photoId}`)
      if (changed) counts.set(photoId, counts.get(photoId)! - 1)
      return { changed, likes: counts.get(photoId)! }
    },
    async state(userId, photoId) {
      return { liked: likes.has(`${userId}|${photoId}`), likes: counts.get(photoId) ?? 0 }
    },
    async raiseNotifiedTier(photoId, tier) {
      if ((told.get(photoId) ?? 0) >= tier) return false
      told.set(photoId, tier)
      return true
    },
  }
  return { repo, likes, counts, told }
}
