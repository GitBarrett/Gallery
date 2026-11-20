import type { ErrorCode, ErrorResponse } from '../../shared/contracts/errors'

/** Erreur à renvoyer au client avec un code stable ; tout autre erreur devient un 500 générique. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

// Mapping centralisé erreur métier → statut HTTP (10-clean-architecture.md § 4)
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

export function toErrorResponse(thrown: unknown, correlationId: string): { status: number; body: ErrorResponse } {
  // h3 enveloppe toute erreur lancée par une route : l'AppError d'origine est alors dans `cause`
  const cause = (thrown as { cause?: unknown } | null)?.cause
  const error = cause instanceof AppError ? cause : thrown
  if (error instanceof AppError) {
    const details = error.details === undefined ? {} : { details: error.details }
    return {
      status: STATUS[error.code],
      body: { error: { code: error.code, message: error.message, ...details, correlationId } },
    }
  }
  // Erreurs du framework (route inconnue, corps illisible…) : seul leur statut est repris
  const status = (error as { statusCode?: number } | null)?.statusCode
  const code = status === undefined ? undefined : CODE_BY_STATUS.get(status)
  if (code && code !== 'INTERNAL')
    return { status: STATUS[code], body: { error: { code, message: code, correlationId } } }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal error', correlationId } } }
}
