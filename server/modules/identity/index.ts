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
  PasswordHasher,
} from './application/ports'
export { signup, SIGNUP_PER_IP, TERMS_VERSION } from './application/signup'
export { verifyEmail } from './application/verify-email'
export { signin } from './application/signin'
export { listSessions, resolveSession, revokeOtherSessions, revokeSession, signout } from './application/sessions'
export type { DeviceSession } from './application/sessions'
export { joinWaitlist } from './application/join-waitlist'
export { resendVerification } from './application/resend-verification'
export { forgotPassword } from './application/forgot-password'
export { resetPassword } from './application/reset-password'
export { requireVerified, type PolicyDenial } from './domain/policies'
export { argon2idHasher } from './infrastructure/argon2id-hasher'
export { drizzleIdentityRepository, purgeExpiredTokens } from './infrastructure/drizzle-identity-repository'
export { hibpBreachChecker } from './infrastructure/hibp-breach-checker'
export { fakeMailer, resendMailer } from './infrastructure/resend-mailer'
export { mailboxKey, mailboxMailer } from './infrastructure/mailbox-mailer'
export { fakeHumanVerifier, turnstileVerifier, TURNSTILE_DUMMY_TOKEN } from './infrastructure/turnstile-verifier'
export { emailsConsumer } from './interface/emails-consumer'
export { orThrow } from './interface/identity-http'
