// Typed API client (10-clean-architecture.md § Front): the only caller of /api. Responses are checked against
// shared/contracts; errors become an ApiError carrying the stable code and the correlation id of the server.
import type { FetchError } from 'ofetch'
import type { z } from 'zod'
import { ErrorResponse, type ErrorCode } from '~~/shared/contracts/errors'
import { HealthResponse } from '~~/shared/contracts/health'

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly correlationId?: string,
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

type Options = NonNullable<Parameters<typeof $fetch>[1]>

// shortcut: $fetch does not forward the visitor's cookies during SSR, switch to useRequestFetch with the session (T-12a)
export async function call<S extends z.ZodType>(path: string, schema: S, options: Options = {}): Promise<z.infer<S>> {
  let body: unknown
  try {
    // Idempotent requests are retried once by $fetch; not on 409 (conflict) nor 429 (wait for Retry-After)
    body = await $fetch(path, { retryStatusCodes: [408, 500, 502, 503, 504], ...options })
  } catch (error) {
    const response = ErrorResponse.safeParse((error as FetchError).data)
    const status = (error as FetchError).statusCode ?? 0
    throw response.success
      ? new ApiError(response.data.error.code, status, response.data.error.correlationId)
      : new ApiError('INTERNAL', status)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new ApiError('INTERNAL', 200)
  return parsed.data
}

/** i18n key of the message to show for any error thrown by the client (`errors.<CODE>`). */
export const errorMessageKey = (error: unknown) => `errors.${error instanceof ApiError ? error.code : 'INTERNAL'}`

export const api = {
  health: () => call('/api/health', HealthResponse),
}
