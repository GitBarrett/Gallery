import { AppError } from '../../../platform/http-errors'
import type { IdentityResult } from '../application/email-tokens'

/** Business error of an identity use case → common HTTP error; a success returns nothing. */
export function orThrow(result: IdentityResult): void {
  if (result.ok) return
  const error = result.error
  if (error.kind === 'rate_limited')
    throw new AppError('RATE_LIMITED', 'Too many requests', { retryAfterSeconds: error.retryAfterSeconds })
  if (error.kind === 'taken') throw new AppError('CONFLICT', `${error.field} already taken`, { field: error.field })
  throw new AppError('VALIDATION_FAILED', `Invalid ${error.field}`, { field: error.field, reason: error.reason })
}
