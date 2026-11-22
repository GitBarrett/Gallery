import { ApiError, errorMessageKey } from '~/services/api'
import { validatePassword, validateUsername } from '~~/shared/domain/account-rules'

export type SignupField = 'username' | 'email' | 'password' | 'turnstileToken'
/** i18n key of a message, under the field it belongs to (no field: shown above the button). */
export type FormError = { field?: SignupField; key: string }

const FIELDS: readonly string[] = ['username', 'email', 'password', 'turnstileToken']

/** Refused sign-up → message (Q42 error shapes), or `invite_required` during the beta (Q43: waiting list). */
export function signupError(error: unknown): FormError | 'invite_required' {
  if (!(error instanceof ApiError)) return { key: errorMessageKey(error) }
  const { code, details } = error
  if (code === 'FORBIDDEN' && details?.reason === 'invite_required') return 'invite_required'
  if (code === 'CONFLICT' && details?.field === 'username')
    return { field: 'username', key: 'auth.errors.username.taken' }
  if (code === 'VALIDATION_FAILED' && details?.field && FIELDS.includes(details.field) && details.reason)
    return { field: details.field as SignupField, key: `auth.errors.${details.field}.${details.reason}` }
  return { key: errorMessageKey(error) }
}

/** Rules checked before sending (shared/domain), same messages as the server's; the server stays the authority. */
export function localSignupError(username: string, password: string): FormError | undefined {
  const name = validateUsername(username)
  if (!name.ok) return { field: 'username', key: `auth.errors.username.${name.error}` }
  const pass = validatePassword(password)
  if (!pass.ok) return { field: 'password', key: `auth.errors.password.${pass.error}` }
  return undefined
}
