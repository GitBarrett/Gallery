import { SOCIAL_PLATFORMS } from '../domain/social-links'
import { z } from './zod'

/** POST /api/auth/signup. Username and password rules are checked by the server (shared/domain/account-rules). */
export const SignupBody = z.strictObject({
  email: z.email().max(254),
  username: z.string().max(64),
  password: z.string().max(512),
  // "I am at least 15 and accept the Terms and Privacy policy" (US-01.7)
  termsAccepted: z.literal(true),
  turnstileToken: z.string().min(1).max(2048),
  locale: z.enum(['en', 'fr']).default('en'),
  // token of the invitation link, required during the beta (features.inviteOnly, US-56.4)
  inviteToken: z.string().min(1).max(128).optional(),
})
export type SignupBody = z.infer<typeof SignupBody>

/** POST /api/waitlist (US-56.4), only while features.inviteOnly is on. */
export const WaitlistBody = z.strictObject({
  email: z.email().max(254),
  turnstileToken: z.string().min(1).max(2048),
  locale: z.enum(['en', 'fr']).default('en'),
})
export type WaitlistBody = z.infer<typeof WaitlistBody>

/** POST /api/auth/verify-email: the token of the link (fragment of the URL, never sent to the server logs); opens the session. */
export const VerifyEmailBody = z.strictObject({ token: z.string().min(1).max(128) })
export type VerifyEmailBody = z.infer<typeof VerifyEmailBody>

/** POST /api/auth/signin. `turnstileToken` is required after repeated failures (400 `turnstileToken: required`). */
export const SigninBody = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(512),
  turnstileToken: z.string().min(1).max(2048).optional(), // required after 5 failures (US-03.3)
})
export type SigninBody = z.infer<typeof SigninBody>

/** GET /api/me: the signed-in member. */
export const MeResponse = z.strictObject({
  id: z.uuid(),
  username: z.string(),
  role: z.enum(['user', 'moderator', 'admin']),
  emailVerified: z.boolean(),
})
export type MeResponse = z.infer<typeof MeResponse>

/** POST /api/auth/resend-verification (signed-in member, US-01.5). */
export const ResendVerificationBody = z.strictObject({ turnstileToken: z.string().min(1).max(2048) })
export type ResendVerificationBody = z.infer<typeof ResendVerificationBody>

/** GET /api/me/sessions (US-03.7): the member's active sessions, latest activity first. `id`: path of DELETE. */
export const SessionsResponse = z.strictObject({
  sessions: z.array(
    z.strictObject({
      id: z.string(),
      device: z.strictObject({ browser: z.string().nullable(), os: z.string().nullable() }),
      createdAt: z.iso.datetime(),
      lastSeenAt: z.iso.datetime(),
      current: z.boolean(),
    }),
  ),
})
export type SessionsResponse = z.infer<typeof SessionsResponse>

/** DELETE /api/me/sessions/{id}: the id of a listed session (SHA-256, hex). */
export const SessionParams = z.strictObject({ id: z.string().regex(/^[0-9a-f]{64}$/) })

/** POST /api/auth/password/forgot (US-04.1): always 204, the email is only sent if the account exists. */
export const ForgotPasswordBody = z.strictObject({
  email: z.email().max(254),
  turnstileToken: z.string().min(1).max(2048),
})
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>

/** POST /api/auth/password/reset (US-04.2–3): the token of the link (URL fragment) and the new password; signs in. */
export const ResetPasswordBody = z.strictObject({
  token: z.string().min(1).max(128),
  password: z.string().max(512),
})
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>

/** POST /api/me/password (US-07.3): the old password proves the owner. */
export const ChangePasswordBody = z.strictObject({
  currentPassword: z.string().max(512),
  password: z.string().max(512),
})
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>

/** PUT and GET /api/me/social-links (US-82.1–3): the whole list of identifiers, one per network at most. */
export const SocialLinksBody = z.strictObject({
  links: z
    .array(z.strictObject({ platform: z.enum(SOCIAL_PLATFORMS), handle: z.string().max(200) }))
    .max(SOCIAL_PLATFORMS.length)
    .refine((links) => new Set(links.map((l) => l.platform)).size === links.length, 'One identifier per network'),
})
export type SocialLinksBody = z.infer<typeof SocialLinksBody>

/** /auth/{provider} and its callback (US-02); Battle.net comes with T-15. */
export const OAuthProviderParams = z.strictObject({ provider: z.enum(['google', 'battlenet']) })

/** GET /auth/{provider}: language of the pages to come back to, invitation of the beta (US-56.4). */
export const OAuthStartQuery = z.strictObject({
  locale: z.enum(['en', 'fr']).default('en'),
  invite: z.string().min(1).max(128).optional(),
})

/** GET /auth/{provider}/callback: the provider adds other parameters (scope, authuser…), ignored. */
export const OAuthCallbackQuery = z.object({
  state: z.string().max(256).optional(),
  code: z.string().max(2048).optional(),
  error: z.string().max(256).optional(),
})

/** GET /api/auth/oauth/pending: the identity waiting for its account (US-02.1) or for the link (US-02.3). */
export const OAuthPendingResponse = z.strictObject({
  provider: z.enum(['google', 'battlenet']),
  email: z.string().nullable(),
  emailTaken: z.boolean(),
})
export type OAuthPendingResponse = z.infer<typeof OAuthPendingResponse>

/** POST /api/auth/oauth/complete (US-02.1): username and Terms of a first OAuth sign-in; signs in. */
export const OAuthCompleteBody = z.strictObject({
  username: z.string().max(64),
  termsAccepted: z.literal(true), // "I am at least 15 and accept the Terms and Privacy policy" (US-01.7)
  locale: z.enum(['en', 'fr']).default('en'),
})
export type OAuthCompleteBody = z.infer<typeof OAuthCompleteBody>

/**
 * PATCH /api/me: new username, once every 30 days (US-05.1, US-05.4), bio and language (US-07.1); at least one
 * field. The bio rules are checked by the server (shared/domain/account-rules). Answers MeResponse.
 */
export const MeUpdateBody = z
  .strictObject({
    username: z.string().max(64).optional(),
    bio: z.string().max(2000).optional(),
    locale: z.enum(['en', 'fr']).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
export type MeUpdateBody = z.infer<typeof MeUpdateBody>

/** GET /api/usernames/{name}/availability (US-05.2), open to everyone. */
export const UsernameParams = z.strictObject({ name: z.string().min(1).max(64) })
export const UsernameAvailabilityResponse = z.discriminatedUnion('available', [
  z.strictObject({ available: z.literal(true) }),
  z.strictObject({
    available: z.literal(false),
    reason: z.enum(['length', 'charset', 'reserved', 'insult', 'taken']),
  }),
])
export type UsernameAvailabilityResponse = z.infer<typeof UsernameAvailabilityResponse>

/** GET /api/users/{username}: any case; 404 for an unknown, banned or deleted account. */
export const ProfileParams = z.strictObject({ username: z.string().min(1).max(64) })

/** GET /api/users/{username} (US-05.3): public profile, the username in its display case. */
export const ProfileResponse = z.strictObject({
  username: z.string(),
  bio: z.string().nullable(),
  memberSince: z.iso.datetime(),
  // US-82.4: built by the server, Discord has no link (copied); empty when hidden (US-82.5)
  socialLinks: z.array(
    z.strictObject({
      platform: z.enum(SOCIAL_PLATFORMS),
      label: z.string(),
      url: z.url({ protocol: /^https$/ }).nullable(),
    }),
  ),
})
export type ProfileResponse = z.infer<typeof ProfileResponse>
