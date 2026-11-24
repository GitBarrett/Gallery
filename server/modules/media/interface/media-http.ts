import type { Result } from '../../../../shared/domain/result'
import { AppError } from '../../../platform/http-errors'
import type { MediaError } from '../application/uploads'

/** Business error of a media use case → common HTTP error; a success returns its value. */
export function orThrow<R extends Result<unknown, MediaError>>(result: R): Extract<R, { ok: true }>['value'] {
  if (result.ok) return result.value as Extract<R, { ok: true }>['value']
  const error = result.error
  if (error.kind === 'rate_limited')
    throw new AppError('RATE_LIMITED', 'Too many uploads', { retryAfterSeconds: error.retryAfterSeconds })
  if (error.kind === 'forbidden') throw new AppError('FORBIDDEN', 'Forbidden', { reason: error.reason })
  if (error.kind === 'not_found') throw new AppError('NOT_FOUND', 'Not found')
  if (error.kind === 'too_large') throw new AppError('PAYLOAD_TOO_LARGE', 'File too large', { field: 'file' })
  if (error.kind === 'mismatch')
    throw new AppError('UNPROCESSABLE', 'The uploaded file differs from the declared one', { reason: error.reason })
  throw new AppError('VALIDATION_FAILED', `Invalid ${error.field}`, { field: error.field, reason: error.reason })
}
