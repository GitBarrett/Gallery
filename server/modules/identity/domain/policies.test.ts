import { describe, expect, it } from 'vitest'
import { requireVerified } from './policies'

describe('requireVerified', () => {
  it('US-08.1 refuses a member whose email is not verified, with the reason the banner shows', () => {
    expect(requireVerified({ emailVerified: false })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'email_unverified' },
    })
  })

  it('accepts a member whose email is verified', () => {
    expect(requireVerified({ emailVerified: true })).toEqual({ ok: true, value: undefined })
  })
})
