import { describe, expect, it } from 'vitest'
import { notSanctioned, requireOwner, requireRole, requireStaff, requireVerified } from './policies'

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
  const refused = { ok: false, error: { kind: 'forbidden', reason: 'role' } }
  const mfa = { mfaVerified: true }

  it('US-55 lets an admin moderate, refuses a member, and keeps administration to admins', () => {
    expect(requireRole({ role: 'admin', ...mfa }, 'moderator')).toEqual({ ok: true, value: undefined })
    expect(requireRole({ role: 'moderator', ...mfa }, 'moderator')).toEqual({ ok: true, value: undefined })
    expect(requireRole({ role: 'user', ...mfa }, 'moderator')).toEqual(refused)
    expect(requireRole({ role: 'moderator', ...mfa }, 'admin')).toEqual(refused)
  })

  it('US-55.2 refuses the staff whose session has not passed the TOTP', () => {
    expect(requireRole({ role: 'admin', mfaVerified: false }, 'moderator')).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'mfa_required' },
    })
  })
})

describe('requireStaff', () => {
  const refused = { ok: false, error: { kind: 'forbidden', reason: 'role' } }

  it('US-55.2 opens the TOTP setup and challenge to the staff only, before the TOTP', () => {
    expect(requireStaff({ role: 'moderator' })).toEqual({ ok: true, value: undefined })
    expect(requireStaff({ role: 'admin' })).toEqual({ ok: true, value: undefined })
    expect(requireStaff({ role: 'user' })).toEqual(refused)
  })
})

describe('requireOwner', () => {
  it('US-55 answers not found for the private resource of another member', () => {
    expect(requireOwner({ id: 'ash' }, 'ash')).toEqual({ ok: true, value: undefined })
    expect(requireOwner({ id: 'ash' }, 'thrall')).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})
