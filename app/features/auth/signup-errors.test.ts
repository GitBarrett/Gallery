import { describe, expect, it } from 'vitest'
import { ApiError } from '~/services/api'
import { localSignupError, signupError } from './signup-errors'

describe('signupError', () => {
  it('US-01.3 shows a breached password under the password field', () => {
    const error = new ApiError('VALIDATION_FAILED', 400, 'c', { field: 'password', reason: 'breached' })
    expect(signupError(error)).toEqual({ field: 'password', key: 'auth.errors.password.breached' })
  })

  it('US-01.6 shows a failed Turnstile check under the check', () => {
    const error = new ApiError('VALIDATION_FAILED', 400, 'c', { field: 'turnstileToken', reason: 'failed' })
    expect(signupError(error)).toEqual({ field: 'turnstileToken', key: 'auth.errors.turnstileToken.failed' })
  })

  it('US-56.4 turns the refusal of the invite-only beta into the waiting list', () => {
    expect(signupError(new ApiError('FORBIDDEN', 403, 'c', { reason: 'invite_required' }))).toBe('invite_required')
  })

  it('shows a taken username under its field, anything else above the button', () => {
    expect(signupError(new ApiError('CONFLICT', 409, 'c', { field: 'username' }))).toEqual({
      field: 'username',
      key: 'auth.errors.username.taken',
    })
    expect(signupError(new ApiError('RATE_LIMITED', 429))).toEqual({ key: 'errors.RATE_LIMITED' })
    expect(signupError(new ApiError('VALIDATION_FAILED', 400, 'c', { field: 'other', reason: 'x' }))).toEqual({
      key: 'errors.VALIDATION_FAILED',
    })
    expect(signupError(new TypeError('offline'))).toEqual({ key: 'errors.INTERNAL' })
  })
})

describe('localSignupError', () => {
  it('checks the username then the password with the shared rules before sending', () => {
    expect(localSignupError('ab', 'a long passphrase')).toEqual({
      field: 'username',
      key: 'auth.errors.username.length',
    })
    expect(localSignupError('Ash_Barrett', 'short')).toEqual({
      field: 'password',
      key: 'auth.errors.password.too_short',
    })
    expect(localSignupError('Ash_Barrett', 'a long passphrase')).toBeUndefined()
  })
})
