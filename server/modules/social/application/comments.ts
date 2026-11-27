import { avatarPath } from '../../../../shared/domain/avatar-file'
import { canEditComment, validateComment } from '../../../../shared/domain/comments'
import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { RateLimiter, RateLimitRule } from '../../../platform/rate-limiter'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { notSanctioned, requireVerified, type Actor } from '../../identity'
import { decodeCommentCursor, encodeCommentCursor } from '../domain/cursor'
import type { SocialError } from './likes'
import type { CommentRow, CommentsRepository } from './ports'

// 08-securite.md § 8: 10 comments per 10 minutes per account (exact counters)
export const COMMENTS_PER_10_MIN: RateLimitRule = { name: 'comments', limit: 10, windowSeconds: 600 }
/** Accounts younger than this solve a Turnstile challenge to comment (US-31.5, 08 § 2). */
const YOUNG_ACCOUNT_MS = 24 * 60 * 60_000

type Deps = {
  repo: CommentsRepository
  uow: UnitOfWork<CommentsRepository>
  limiter: RateLimiter
  /** The Turnstile check of the identity module, for the form `comment`. */
  human: (token: string, ip: string | undefined) => Promise<boolean>
  clock: Clock
}

export interface CommentView {
  id: string
  body: string
  author: { username: string; avatarUrl: string | null }
  createdAt: Date
  editedAt: Date | null
}

const toView = (row: CommentRow): CommentView => ({
  id: row.id,
  body: row.body,
  author: { username: row.username, avatarUrl: avatarPath(row.userId, row.avatarKey) },
  createdAt: row.createdAt,
  editedAt: row.editedAt,
})

const mayComment = (actor: Actor) => {
  const verified = requireVerified(actor) // US-08.1
  return verified.ok ? notSanctioned(actor) : verified
}

// Turnstile for the first day of an account (US-31.5): a token solved for the form `comment`
async function humanEnough(deps: Deps, actor: Actor, token: string | undefined, ip: string | undefined) {
  const created = await deps.repo.accountCreatedAt(actor.id)
  const young = !created || deps.clock.now().getTime() - created.getTime() < YOUNG_ACCOUNT_MS
  return !young || (token !== undefined && (await deps.human(token, ip)))
}

/**
 * Comment (US-31.1, US-31.2, US-31.5; annexe B): a verified member who is not sanctioned writes 1 to 1 000
 * characters without an insult under a public capture, 10 every 10 minutes at most, with a Turnstile token the first
 * day of their account. The text is kept as written (the screen shows it as text); the author of the capture is told.
 */
export const postComment =
  (deps: Deps) =>
  async (cmd: {
    actor: Actor
    photoId: string
    body: string
    turnstileToken?: string
    ip?: string
  }): Promise<Result<CommentView, SocialError>> => {
    const allowed = mayComment(cmd.actor)
    if (!allowed.ok) return allowed
    const body = validateComment(cmd.body)
    if (!body.ok) return err({ kind: 'invalid', field: 'body', reason: body.error })
    const target = await deps.repo.target(cmd.photoId)
    if (!target?.public) return err({ kind: 'not_found' })
    if (!(await humanEnough(deps, cmd.actor, cmd.turnstileToken, cmd.ip)))
      return err({ kind: 'invalid', field: 'turnstileToken', reason: 'failed' })
    // Before the transaction: the counters use their own connection (a pool of one)
    const limit = await deps.limiter.consume(COMMENTS_PER_10_MIN, cmd.actor.id)
    if (!limit.allowed) return err({ kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds })
    const added = await deps.uow.run(async (repo, publish) => {
      const comment = await repo.add({ photoId: cmd.photoId, userId: cmd.actor.id, body: body.value })
      if (target.authorId !== cmd.actor.id)
        publish({
          topic: 'notifications',
          payload: {
            type: 'comment',
            userId: target.authorId,
            photoId: cmd.photoId,
            commentId: comment.id,
            actorId: cmd.actor.id,
          },
        })
      return comment
    })
    const { id, username, avatar } = cmd.actor
    return ok(toView({ ...added, body: body.value, userId: id, username, avatarKey: avatar ?? null, editedAt: null }))
  }

/** Edit (US-31.3): its author, within 15 minutes, with the same rules as a new comment; marked edited. */
export const editComment =
  (deps: Pick<Deps, 'repo' | 'clock'>) => async (cmd: { actor: Actor; commentId: string; body: string }) => {
    const body = validateComment(cmd.body)
    const comment = await deps.repo.find(cmd.commentId)
    if (!comment) return err<SocialError>({ kind: 'not_found' })
    if (comment.userId !== cmd.actor.id) return err<SocialError>({ kind: 'forbidden', reason: 'not_author' })
    const now = deps.clock.now()
    if (!canEditComment(comment.createdAt, now)) return err<SocialError>({ kind: 'forbidden', reason: 'edit_window' })
    if (!body.ok) return err<SocialError>({ kind: 'invalid', field: 'body', reason: body.error })
    await deps.repo.edit(comment.id, body.value, now)
    return ok({ id: comment.id, body: body.value, editedAt: now })
  }

/**
 * Delete (US-31.4; annexe B): the author of the comment or of its capture, sanctioned or not, deletes it for good;
 * the moderators go through the moderation (T-50).
 */
export const deleteComment =
  (deps: Pick<Deps, 'repo'>) =>
  async (cmd: { actor: Actor; commentId: string }): Promise<Result<undefined, SocialError>> => {
    const comment = await deps.repo.find(cmd.commentId)
    if (!comment) return err({ kind: 'not_found' })
    if (![comment.userId, comment.photoAuthorId].includes(cmd.actor.id))
      return err({ kind: 'forbidden', reason: 'not_author' })
    await deps.repo.remove(comment.id)
    return ok(undefined)
  }

/** The comments of a public capture (US-31.1; public read), newest first, by pages of `limit`. */
export const listComments =
  (deps: Pick<Deps, 'repo'>) =>
  async (cmd: {
    photoId: string
    cursor?: string
    limit: number
  }): Promise<Result<{ items: CommentView[]; nextCursor: string | null }, SocialError>> => {
    const after = cmd.cursor ? decodeCommentCursor(cmd.cursor) : undefined
    if (after === null) return err({ kind: 'invalid', field: 'cursor', reason: 'unknown' })
    const target = await deps.repo.target(cmd.photoId)
    if (!target?.public) return err({ kind: 'not_found' })
    const rows = await deps.repo.list(cmd.photoId, after, cmd.limit + 1)
    const page = rows.slice(0, cmd.limit)
    const last = page.at(-1)
    return ok({
      items: page.map(toView),
      nextCursor: rows.length > cmd.limit && last ? encodeCommentCursor(last) : null,
    })
  }
