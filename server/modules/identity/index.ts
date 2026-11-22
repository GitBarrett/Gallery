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
  NewUser,
  PasswordHasher,
} from './application/ports'
export { signup, SIGNUP_PER_IP, TERMS_VERSION } from './application/signup'
export { verifyEmail } from './application/verify-email'
export { signin } from './application/signin'
export { resolveSession, signout } from './application/sessions'
export { joinWaitlist } from './application/join-waitlist'
export { resendVerification } from './application/resend-verification'
export { requireVerified, type PolicyDenial } from './domain/policies'
export { argon2idHasher } from './infrastructure/argon2id-hasher'
export { drizzleIdentityRepository, purgeExpiredTokens } from './infrastructure/drizzle-identity-repository'
export { hibpBreachChecker } from './infrastructure/hibp-breach-checker'
export { fakeMailer, resendMailer } from './infrastructure/resend-mailer'
export { fakeHumanVerifier, turnstileVerifier, TURNSTILE_DUMMY_TOKEN } from './infrastructure/turnstile-verifier'
export { emailsConsumer } from './interface/emails-consumer'
export { orThrow } from './interface/identity-http'
