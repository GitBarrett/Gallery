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

/** POST /api/auth/signin. The Turnstile token required after failures comes with the lockout (T-12c). */
export const SigninBody = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(512),
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
