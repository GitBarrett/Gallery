// Typed API client (10-clean-architecture.md § Front): the only caller of /api. Responses are checked against
// shared/contracts; errors become an ApiError carrying the stable code and the correlation id of the server.
import type { FetchError } from 'ofetch'
import { z } from '~~/shared/contracts/zod'
import { ErrorResponse, type ErrorCode } from '~~/shared/contracts/errors'
import { HealthResponse } from '~~/shared/contracts/health'
import { PublicSettings } from '~~/shared/contracts/settings'
import {
  type ForgotPasswordBody,
  MeResponse,
  type ResendVerificationBody,
  type ResetPasswordBody,
  SessionsResponse,
  type SigninBody,
  type SignupBody,
  type VerifyEmailBody,
  type WaitlistBody,
} from '~~/shared/contracts/auth'

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly correlationId?: string,
    /** `{ field, reason }` of a VALIDATION_FAILED, `{ reason }` of a FORBIDDEN… (03-architecture.md § Conventions d'API) */
    readonly details?: { field?: string; reason?: string },
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

type Options = NonNullable<Parameters<typeof $fetch>[1]>

// `fetch`: useRequestFetch() for a read that needs the visitor's cookies during SSR (plain $fetch drops them)
export async function call<S extends z.ZodType>(
  path: string,
  schema: S,
  options: Options = {},
  fetch: typeof $fetch = $fetch,
): Promise<z.infer<S>> {
  let body: unknown
  try {
    // Idempotent requests are retried once by $fetch; not on 409 (conflict) nor 429 (wait for Retry-After)
    body = await fetch(path, { retryStatusCodes: [408, 500, 502, 503, 504], ...options })
  } catch (error) {
    const response = ErrorResponse.safeParse((error as FetchError).data)
    const status = (error as FetchError).statusCode ?? 0
    throw response.success
      ? new ApiError(
          response.data.error.code,
          status,
          response.data.error.correlationId,
          response.data.error.details as ApiError['details'],
        )
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
  publicSettings: () => call('/api/settings/public', PublicSettings),
  // 204 without body (US-01.2, US-56.4: the same answer whatever the email)
  signup: (body: SignupBody) => call('/api/auth/signup', z.unknown(), { method: 'POST', body }),
  waitlist: (body: WaitlistBody) => call('/api/waitlist', z.unknown(), { method: 'POST', body }),
  // 204, the session cookie is set (US-03.1)
  signin: (body: SigninBody) => call('/api/auth/signin', z.unknown(), { method: 'POST', body }),
  signout: () => call('/api/auth/signout', z.unknown(), { method: 'POST' }),
  me: (fetch?: typeof $fetch) => call('/api/me', MeResponse, {}, fetch),
  // 204: email verified and session opened (US-01.4, Q44)
  verifyEmail: (body: VerifyEmailBody) => call('/api/auth/verify-email', z.unknown(), { method: 'POST', body }),
  resendVerification: (body: ResendVerificationBody) =>
    call('/api/auth/resend-verification', z.unknown(), { method: 'POST', body }),
  // 204 whatever the email (US-04.1, US-04.4)
  forgotPassword: (body: ForgotPasswordBody) =>
    call('/api/auth/password/forgot', z.unknown(), { method: 'POST', body }),
  // 204: password changed, every session ended, a new one opened (US-04.3)
  resetPassword: (body: ResetPasswordBody) => call('/api/auth/password/reset', z.unknown(), { method: 'POST', body }),
  sessions: () => call('/api/me/sessions', SessionsResponse),
  // 204 (US-03.8, US-03.9)
  revokeSession: (id: string) => call(`/api/me/sessions/${id}`, z.unknown(), { method: 'DELETE' }),
  revokeOtherSessions: () => call('/api/me/sessions/revoke-others', z.unknown(), { method: 'POST' }),
}
