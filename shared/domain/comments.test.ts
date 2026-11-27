import { describe, expect, it } from 'vitest'
import { canEditComment, COMMENT_EDIT_MS, COMMENT_MAX, validateComment } from './comments'

describe('validateComment', () => {
  it('US-31.1 keeps 1 to 1 000 characters, trimmed, counted as characters not UTF-16 units', () => {
    expect(validateComment('  Lovely light  ')).toEqual({ ok: true, value: 'Lovely light' })
    expect(validateComment('a'.repeat(COMMENT_MAX))).toEqual({ ok: true, value: 'a'.repeat(1000) })
    expect(validateComment('🌙'.repeat(1000)).ok).toBe(true) // 2 000 UTF-16 units, 1 000 characters
    expect(validateComment('a'.repeat(1001))).toEqual({ ok: false, error: 'too_long' })
    expect(validateComment('   ')).toEqual({ ok: false, error: 'empty' })
  })

  it('US-31.1 keeps HTML and Markdown as they are: the screen renders text', () => {
    expect(validateComment('<script>alert(1)</script> **bold**')).toEqual({
      ok: true,
      value: '<script>alert(1)</script> **bold**',
    })
  })

  it('US-31.2 refuses a comment with an insult of the list', () => {
    expect(validateComment('What a connard')).toEqual({ ok: false, error: 'insult' })
  })
})

describe('canEditComment', () => {
  it('US-31.3 lets its author edit a comment for 15 minutes', () => {
    const at = new Date('2026-11-27T10:00:00Z')
    expect(COMMENT_EDIT_MS).toBe(15 * 60_000)
    expect(canEditComment(at, new Date(at.getTime() + COMMENT_EDIT_MS - 1))).toBe(true)
    expect(canEditComment(at, new Date(at.getTime() + COMMENT_EDIT_MS))).toBe(false)
  })
})
