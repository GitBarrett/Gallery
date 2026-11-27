import { describe, expect, it } from 'vitest'
import { decodeCommentCursor, encodeCommentCursor } from './cursor'

describe('comment cursor', () => {
  it('gives back the key it was made from, and null for anything else', () => {
    const key = { createdAt: new Date('2026-11-27T10:00:00.123Z'), id: '0193a000-0000-7000-8000-0000000000c1' }
    expect(decodeCommentCursor(encodeCommentCursor(key))).toEqual(key)
    for (const cursor of ['', '%%%', btoa('nope'), btoa('2026-11-27T10:00:00Z|not-a-uuid'), btoa(`bad|${key.id}`)])
      expect(decodeCommentCursor(cursor), cursor).toBeNull()
  })
})
