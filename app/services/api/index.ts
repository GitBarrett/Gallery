// Typed API client (10-clean-architecture.md § Front): the only caller of /api. Responses are checked against
// shared/contracts; errors become an ApiError carrying the stable code and the correlation id of the server.
import type { FetchError } from 'ofetch'
import { z } from '~~/shared/contracts/zod'
import { ErrorResponse, type ErrorCode } from '~~/shared/contracts/errors'
import { HealthResponse } from '~~/shared/contracts/health'
import { NotificationsResponse, UnreadCountResponse } from '~~/shared/contracts/notifications'
import { GameVersionsResponse, TagSuggestResponse, ZoneSuggestResponse } from '~~/shared/contracts/catalog'
import {
  AvatarUploadUrlResponse,
  type CompleteUploadBody,
  CompleteUploadResponse,
  MyPhotoResponse,
  MyPhotosResponse,
  type UpdatePhotoBody,
  type UploadUrlBody,
  UploadUrlResponse,
} from '~~/shared/contracts/photos'
import { PublicSettings } from '~~/shared/contracts/settings'
import {
  AccountResponse,
  type EmailChangeBody,
  type ForgotPasswordBody,
  MeResponse,
  type MeUpdateBody,
  type OAuthCompleteBody,
  OAuthPendingResponse,
  ProfileResponse,
  type ResendVerificationBody,
  type ResetPasswordBody,
  type ChangePasswordBody,
  SessionsResponse,
  SocialLinksBody,
  type SigninBody,
  type SignupBody,
  UsernameAvailabilityResponse,
  type VerifyEmailBody,
  type WaitlistBody,
} from '~~/shared/contracts/auth'

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly correlationId?: string,
    /** `{ field, reason }` of a VALIDATION_FAILED, `{ reason }` of a FORBIDDEN, `{ retryAfterSeconds }` of a RATE_LIMITED… */
    readonly details?: { field?: string; reason?: string; retryAfterSeconds?: number },
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
  // US-07.3: 400 VALIDATION_FAILED field currentPassword (wrong, none) or password, 429 after 5 wrong old passwords
  changePassword: (body: ChangePasswordBody) => call('/api/me/password', z.unknown(), { method: 'POST', body }),
  // US-82: identifiers as stored; PUT replaces the list, 400 VALIDATION_FAILED field = the network, 429 after 20 / h
  socialLinks: () => call('/api/me/social-links', SocialLinksBody),
  // US-07.2: email of the account; the change sends a link (204 even for another account's address), 429 after 3 / h
  account: () => call('/api/me/account', AccountResponse),
  changeEmail: (body: EmailChangeBody) => call('/api/me/email', z.unknown(), { method: 'POST', body }),
  // US-07.4: 403 FORBIDDEN reason last_sign_in_method, 404 when not linked
  unlinkOAuth: (provider: 'google' | 'battlenet') =>
    call(`/api/me/oauth/${provider}`, z.unknown(), { method: 'DELETE' }),
  confirmEmail: (body: VerifyEmailBody) => call('/api/auth/email/confirm', z.unknown(), { method: 'POST', body }),
  setSocialLinks: (body: SocialLinksBody) => call('/api/me/social-links', z.unknown(), { method: 'PUT', body }),
  // public profile (US-05.3); 404 NOT_FOUND for an unknown, banned or deleted account
  profile: (username: string, fetch?: typeof $fetch) =>
    call(`/api/users/${encodeURIComponent(username)}`, ProfileResponse, {}, fetch),
  // US-05.1, US-05.4: 409 CONFLICT when taken, 429 RATE_LIMITED within 30 days of the last change
  updateMe: (body: MeUpdateBody) => call('/api/me', MeResponse, { method: 'PATCH', body }),
  // US-05.2: why a username cannot be used
  usernameAvailability: (name: string) =>
    call(`/api/usernames/${encodeURIComponent(name)}/availability`, UsernameAvailabilityResponse),
  sessions: () => call('/api/me/sessions', SessionsResponse),
  // 204 (US-03.8, US-03.9)
  revokeSession: (id: string) => call(`/api/me/sessions/${id}`, z.unknown(), { method: 'DELETE' }),
  revokeOtherSessions: () => call('/api/me/sessions/revoke-others', z.unknown(), { method: 'POST' }),
  // identity back from the provider, waiting for its account or its link (US-02.1, US-02.3); 404 once gone
  oauthPending: () => call('/api/auth/oauth/pending', OAuthPendingResponse),
  // 204: account created and session opened (US-02.1)
  completeOAuth: (body: OAuthCompleteBody) => call('/api/auth/oauth/complete', z.unknown(), { method: 'POST', body }),
  // Quest log and bell (US-35.1, US-35.3); 404 for another member's notification
  notifications: () => call('/api/notifications', NotificationsResponse),
  unreadCount: () => call('/api/notifications/unread-count', UnreadCountResponse),
  markNotificationRead: (id: string) => call(`/api/notifications/${id}/read`, z.unknown(), { method: 'POST' }),
  markAllNotificationsRead: () => call('/api/notifications/read-all', z.unknown(), { method: 'POST' }),
  // « My captures » (US-14.4): every status, 30 per page
  myPhotos: (cursor?: string) => call('/api/me/photos', MyPhotosResponse, { query: cursor ? { cursor } : {} }),
  // Upload form (US-10, US-11): catalogue reads, then the presigned URL and the completion (03 § Pipeline image)
  gameVersions: () => call('/api/game-versions', GameVersionsResponse),
  suggestTags: (q: string) => call('/api/tags/suggest', TagSuggestResponse, { query: { q } }),
  suggestZones: (q: string) => call('/api/zones/suggest', ZoneSuggestResponse, { query: { q } }),
  uploadUrl: (body: UploadUrlBody) => call('/api/photos/upload-url', UploadUrlResponse, { method: 'POST', body }),
  // Idempotent on the server: a retry after a lost answer completes once
  completeUpload: (photoId: string, body: CompleteUploadBody) =>
    call(`/api/photos/${photoId}/complete`, CompleteUploadResponse, {
      method: 'POST',
      body,
      headers: { 'idempotency-key': photoId },
    }),
  // Edit and deletion of one's own capture (US-12.1, US-12.2)
  myPhoto: (id: string) => call(`/api/me/photos/${id}`, MyPhotoResponse),
  updatePhoto: (id: string, body: UpdatePhotoBody) => call(`/api/photos/${id}`, z.unknown(), { method: 'PATCH', body }),
  deletePhoto: (id: string) => call(`/api/photos/${id}`, z.unknown(), { method: 'DELETE' }),
  // New avatar (US-07.6): a square file of 2 MB at most, put, then 204 once sent to moderation; 429 after 10 a day
  avatarUploadUrl: (body: UploadUrlBody) =>
    call('/api/me/avatar-upload-url', AvatarUploadUrlResponse, { method: 'POST', body }),
  completeAvatar: (version: string) =>
    call('/api/me/avatar/complete', z.unknown(), { method: 'POST', body: { version } }),
}
