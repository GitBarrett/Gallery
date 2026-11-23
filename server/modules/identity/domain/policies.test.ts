import { describe, expect, it } from 'vitest'
import { notSanctioned, requireOwner, requireRole, requireVerified } from './policies'

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

describe('notSanctioned', () => {
  it('US-55 refuses a suspended member and accepts an active one', () => {
    expect(notSanctioned({ status: 'suspended' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'suspended' },
    })
    expect(notSanctioned({ status: 'active' })).toEqual({ ok: true, value: undefined })
  })
})

describe('requireRole', () => {
  it('US-55 lets an admin moderate, refuses a member, and keeps administration to admins', () => {
    const refused = { ok: false, error: { kind: 'forbidden', reason: 'role' } }
    expect(requireRole({ role: 'admin' }, 'moderator')).toEqual({ ok: true, value: undefined })
    expect(requireRole({ role: 'moderator' }, 'moderator')).toEqual({ ok: true, value: undefined })
    expect(requireRole({ role: 'user' }, 'moderator')).toEqual(refused)
    expect(requireRole({ role: 'moderator' }, 'admin')).toEqual(refused)
  })
})

describe('requireOwner', () => {
  it('US-55 answers not found for the private resource of another member', () => {
    expect(requireOwner({ id: 'ash' }, 'ash')).toEqual({ ok: true, value: undefined })
    expect(requireOwner({ id: 'ash' }, 'thrall')).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})
