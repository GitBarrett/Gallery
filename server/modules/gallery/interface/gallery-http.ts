import type { Result } from '../../../../shared/domain/result'
import { AppError } from '../../../platform/http-errors'
import type { GalleryError } from '../application/grid'

/** Business error of a gallery use case → common HTTP error; a success returns its value. */
export function orThrow<R extends Result<unknown, GalleryError>>(result: R): Extract<R, { ok: true }>['value'] {
  if (result.ok) return result.value as Extract<R, { ok: true }>['value']
  const error = result.error
  if (error.kind === 'not_found') throw new AppError('NOT_FOUND', 'Not found')
  throw new AppError('VALIDATION_FAILED', `Invalid ${error.field}`, { field: error.field, reason: error.reason })
}
