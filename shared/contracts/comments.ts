import { z } from 'zod'

/** GET /api/photos/{id}/comments (US-31.1): newest first, `cursor` the `nextCursor` of the previous page. */
export const CommentsQuery = z.strictObject({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
})

/**
 * POST /api/photos/{id}/comments, PATCH /api/comments/{id} (US-31): the text, checked by the server (1 to 1 000
 * characters, insults); `turnstileToken` for an account of less than 24 hours (US-31.5).
 */
export const CommentBody = z.strictObject({
  body: z.string().max(4000),
  turnstileToken: z.string().min(1).max(2048).optional(),
})
export type CommentBody = z.infer<typeof CommentBody>

export const CommentParams = z.strictObject({ id: z.uuid() })

/** A comment: its text as written, to show as text only (US-31.1). */
export const CommentItem = z.strictObject({
  id: z.uuid(),
  body: z.string(),
  author: z.strictObject({ username: z.string(), avatarUrl: z.string().nullable() }),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
})
export type CommentItem = z.infer<typeof CommentItem>

export const CommentsResponse = z.strictObject({ items: z.array(CommentItem), nextCursor: z.string().nullable() })
export type CommentsResponse = z.infer<typeof CommentsResponse>

/** PATCH answer: the text kept and the date of the edit (« edited », US-31.3). */
export const CommentEdited = z.strictObject({ id: z.uuid(), body: z.string(), editedAt: z.iso.datetime() })
export type CommentEdited = z.infer<typeof CommentEdited>
