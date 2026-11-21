import type { ErrorCode, ErrorResponse } from '../../shared/contracts/errors'

/** Error returned to the client with a stable code; any other error becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

// Central mapping business error → HTTP status (10-clean-architecture.md § 4)
const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}
const CODE_BY_STATUS = new Map(Object.entries(STATUS).map(([code, status]) => [status, code as ErrorCode]))

export function toErrorResponse(
  thrown: unknown,
  correlationId: string,
): { status: number; body: ErrorResponse; headers: Record<string, string> } {
  // h3 wraps any error thrown by a route: the original AppError is then in `cause`
  const cause = (thrown as { cause?: unknown } | null)?.cause
  const error = cause instanceof AppError ? cause : thrown
  if (error instanceof AppError) {
    const details = error.details === undefined ? {} : { details: error.details }
    // 429: delay before retrying, given by the RateLimiter
    const retryAfter = (error.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds
    return {
      status: STATUS[error.code],
      body: { error: { code: error.code, message: error.message, ...details, correlationId } },
      headers:
        error.code === 'RATE_LIMITED' && typeof retryAfter === 'number' ? { 'retry-after': String(retryAfter) } : {},
    }
  }
  // Framework errors (unknown route, unreadable body…): only their status is kept
  const status = (error as { statusCode?: number } | null)?.statusCode
  const code = status === undefined ? undefined : CODE_BY_STATUS.get(status)
  if (code && code !== 'INTERNAL')
    return { status: STATUS[code], body: { error: { code, message: code, correlationId } }, headers: {} }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal error', correlationId } }, headers: {} }
}
