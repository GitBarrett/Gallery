import type { Result } from '../../../../shared/domain/result'
import { AppError } from '../../../platform/http-errors'
import type { SocialError } from '../application/likes'

/** Business error of a social use case → common HTTP error; a success returns its value. */
export function orThrow<R extends Result<unknown, SocialError>>(result: R): Extract<R, { ok: true }>['value'] {
  if (result.ok) return result.value as Extract<R, { ok: true }>['value']
  const error = result.error
  if (error.kind === 'rate_limited')
    throw new AppError('RATE_LIMITED', 'Too many requests', { retryAfterSeconds: error.retryAfterSeconds })
  if (error.kind === 'forbidden') throw new AppError('FORBIDDEN', 'Forbidden', { reason: error.reason })
  throw new AppError('NOT_FOUND', 'Not found')
}
