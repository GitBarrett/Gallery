import { describe, expect, it } from 'vitest'
import { err, ok } from './result'

describe('Result', () => {
  it('wraps a value or an expected error', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
    expect(err('NOT_FOUND')).toEqual({ ok: false, error: 'NOT_FOUND' })
  })
})
