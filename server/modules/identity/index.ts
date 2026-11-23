// identity module (03-architecture.md § Modules): accounts, passwords, emails.
export type {
  Actor,
  BetaInvite,
  BreachChecker,
  EmailMessage,
  EmailToken,
  HumanVerifier,
  IdentityRepository,
  Locale,
  Mailer,
  NewSession,
  SessionSummary,
  NewUser,
  OAuthProvider,
  OAuthProviderName,
  PasswordHasher,
  SocialLink,
} from './application/ports'
export { signup, SIGNUP_PER_IP, TERMS_VERSION } from './application/signup'
export { verifyEmail } from './application/verify-email'
export { signin } from './application/signin'
export { completeOAuthSignup, oauthCallback, startOAuth, type PendingOAuth } from './application/oauth'
export { battlenetOAuthProvider, fakeOAuthProvider, googleOAuthProvider } from './infrastructure/oauth-providers'
export { listSessions, resolveSession, revokeOtherSessions, revokeSession, signout } from './application/sessions'
export type { DeviceSession } from './application/sessions'
export { joinWaitlist } from './application/join-waitlist'
export { resendVerification } from './application/resend-verification'
export { forgotPassword } from './application/forgot-password'
export { resetPassword } from './application/reset-password'
export { changePassword } from './application/change-password'
export { getSocialLinks, setSocialLinks } from './application/social-links'
export { confirmEmailChange, getAccount, requestEmailChange } from './application/email-change'
export { getProfile, updateProfile } from './application/profiles'
export { changeUsername, usernameAvailability } from './application/usernames'
export { requireVerified, type PolicyDenial } from './domain/policies'
export { argon2idHasher } from './infrastructure/argon2id-hasher'
export {
  drizzleIdentityRepository,
  purgeExpiredRedirects,
  purgeExpiredTokens,
} from './infrastructure/drizzle-identity-repository'
export { hibpBreachChecker } from './infrastructure/hibp-breach-checker'
export { fakeMailer, resendMailer } from './infrastructure/resend-mailer'
export { mailboxKey, mailboxMailer } from './infrastructure/mailbox-mailer'
export { fakeHumanVerifier, turnstileVerifier, TURNSTILE_DUMMY_TOKEN } from './infrastructure/turnstile-verifier'
export { emailsConsumer } from './interface/emails-consumer'
export { orThrow } from './interface/identity-http'
