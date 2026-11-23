import type { Result } from '../../../../shared/domain/result'
import { AppError } from '../../../platform/http-errors'
import type { IdentityError } from '../application/email-tokens'

/** Business error of an identity use case → common HTTP error; a success returns its value. */
export function orThrow<R extends Result<unknown, IdentityError>>(result: R): Extract<R, { ok: true }>['value'] {
  if (result.ok) return result.value as Extract<R, { ok: true }>['value']
  const error = result.error
  if (error.kind === 'rate_limited')
    throw new AppError('RATE_LIMITED', 'Too many requests', { retryAfterSeconds: error.retryAfterSeconds })
  if (error.kind === 'invite_required')
    throw new AppError('FORBIDDEN', 'An invitation is required', { reason: 'invite_required' })
  if (error.kind === 'invalid_credentials')
    throw new AppError('UNAUTHENTICATED', 'Invalid email or password', { reason: 'invalid_credentials' })
  if (error.kind === 'forbidden') throw new AppError('FORBIDDEN', 'Forbidden', { reason: error.reason })
  if (error.kind === 'oauth_failed')
    throw new AppError('UNAUTHENTICATED', 'Sign-in with the provider failed', { reason: 'oauth_failed' })
  if (error.kind === 'not_found') throw new AppError('NOT_FOUND', 'Not found')
  if (error.kind === 'taken') throw new AppError('CONFLICT', `${error.field} already taken`, { field: error.field })
  throw new AppError('VALIDATION_FAILED', `Invalid ${error.field}`, { field: error.field, reason: error.reason })
}
