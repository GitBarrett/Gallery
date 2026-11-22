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
})
export type SignupBody = z.infer<typeof SignupBody>

/** POST /api/auth/verify-email: the token of the link (fragment of the URL, never sent to the server logs). */
export const VerifyEmailBody = z.strictObject({ token: z.string().min(1).max(128) })
export type VerifyEmailBody = z.infer<typeof VerifyEmailBody>
