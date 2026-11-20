import { z } from 'zod'

/** Liste unique des codes d'erreur de l'API (03-architecture.md § Conventions d'API), traduits côté client. */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Format commun `{ error: { code, message, details?, correlationId } }`. */
export const ErrorResponse = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string(),
  }),
})
export type ErrorResponse = z.infer<typeof ErrorResponse>
