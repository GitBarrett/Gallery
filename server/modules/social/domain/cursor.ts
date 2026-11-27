/** Keyset of a page of comments (newest first): the date and id of the last comment shown, opaque to the client. */
export interface CommentKey {
  createdAt: Date
  id: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const encodeCommentCursor = (key: CommentKey) => btoa(`${key.createdAt.toISOString()}|${key.id}`)

/** The key of a cursor, null when it was not made by encodeCommentCursor. */
export function decodeCommentCursor(cursor: string): CommentKey | null {
  let text: string
  try {
    text = atob(cursor)
  } catch {
    return null
  }
  const [iso, id] = text.split('|')
  const createdAt = new Date(iso ?? '')
  return id && UUID.test(id) && !Number.isNaN(createdAt.getTime()) ? { createdAt, id } : null
}
