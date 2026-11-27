import { qualityFromLikes, QUALITIES, type QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { notSanctioned, type Actor, type PolicyDenial } from '../../identity'
import type { LikesRepository } from './ports'

// 08-securite.md § 8: 120 likes per hour per account (exact counters); an unlike is not limited
export const LIKES_PER_HOUR: RateLimitRule = { name: 'likes', limit: 120, windowSeconds: 3600 }

export type SocialError =
  | PolicyDenial
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'invalid'; field: string; reason: string }
  /** A comment of another member (US-31.3, US-31.4), or older than its 15 minutes of edition. */
  | { kind: 'forbidden'; reason: 'not_author' | 'edit_window' }
type Deps = { uow: UnitOfWork<LikesRepository>; limiter: RateLimiter; thresholds: () => Promise<QualityThresholds> }
type Liked = { liked: boolean; likes: number }

/**
 * Like (US-30; annexe B): a member who is not sanctioned, verified or not (US-08.2), likes a public capture of
 * another member (their own: 403, US-30.2), 120 times an hour at most (US-30.5); once only (US-30.3). The author is
 * told of the like (grouped by the notifications, US-35.2) and, once per tier, of the quality it reaches (US-71.4).
 */
export const likePhoto =
  (deps: Deps) =>
  async (cmd: { actor: Actor; photoId: string }): Promise<Result<Liked, SocialError>> => {
    const allowed = notSanctioned(cmd.actor)
    if (!allowed.ok) return allowed
    const thresholds = await deps.thresholds()
    // Before the transaction: the counters use their own connection, which a pool of one would wait for forever
    const limit = await deps.limiter.consume(LIKES_PER_HOUR, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    return deps.uow.run(async (repo, publish) => {
      const target = await repo.target(cmd.photoId)
      if (!target?.public) return err({ kind: 'not_found' })
      if (target.authorId === cmd.actor.id) return err({ kind: 'forbidden', reason: 'owner' })
      const { changed, likes } = await repo.add(cmd.actor.id, cmd.photoId)
      if (!changed) return ok({ liked: true, likes })
      const author = { userId: target.authorId, photoId: cmd.photoId }
      publish({ topic: 'notifications', payload: { type: 'like', ...author, actorId: cmd.actor.id } })
      const quality = qualityFromLikes(likes, thresholds)
      const tier = QUALITIES.indexOf(quality)
      if (tier > 0 && (await repo.raiseNotifiedTier(cmd.photoId, tier)))
        publish({ topic: 'notifications', payload: { type: 'quality', ...author, quality } })
      return ok({ liked: true, likes })
    })
  }

/** Whether the member likes a public capture, and its counter, for the Like button (US-30.1). */
export const viewLike =
  (deps: { repo: LikesRepository }) =>
  async (cmd: { actor: Actor; photoId: string }): Promise<Result<Liked, SocialError>> => {
    const target = await deps.repo.target(cmd.photoId)
    if (!target?.public) return err({ kind: 'not_found' })
    return ok(await deps.repo.state(cmd.actor.id, cmd.photoId))
  }

/** Unlike (US-30.1): any member removes their like of a public capture; the tiers told stay (US-71.4). */
export const unlikePhoto =
  (deps: Pick<Deps, 'uow'>) =>
  async (cmd: { actor: Actor; photoId: string }): Promise<Result<Liked, SocialError>> =>
    deps.uow.run(async (repo) => {
      const target = await repo.target(cmd.photoId)
      if (!target?.public) return err({ kind: 'not_found' })
      const { likes } = await repo.remove(cmd.actor.id, cmd.photoId)
      return ok({ liked: false, likes })
    })
