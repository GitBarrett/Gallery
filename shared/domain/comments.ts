import { hasInsult } from './account-rules'
import { err, ok, type Result } from './result'

/** Length of a comment, in characters (US-31.1). */
export const COMMENT_MAX = 1000
/** How long its author may edit a comment (US-31.3). */
export const COMMENT_EDIT_MS = 15 * 60_000

export type CommentProblem = 'empty' | 'too_long' | 'insult'

/**
 * A comment as stored (US-31.1, US-31.2): trimmed, 1 to 1 000 characters (code points), without an insult of the
 * list (Q8). Its text stays as written: HTML or Markdown is shown as text, never interpreted.
 */
export function validateComment(body: string): Result<string, CommentProblem> {
  const text = body.trim()
  if (!text) return err('empty')
  if ([...text].length > COMMENT_MAX) return err('too_long')
  if (hasInsult(text)) return err('insult')
  return ok(text)
}

/** Whether a comment written at `createdAt` may still be edited at `now` (US-31.3). */
export const canEditComment = (createdAt: Date, now: Date) => now.getTime() - createdAt.getTime() < COMMENT_EDIT_MS
