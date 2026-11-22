// identity module (03-architecture.md § Modules): accounts, passwords, emails.
export type {
  BetaInvite,
  BreachChecker,
  EmailMessage,
  EmailToken,
  HumanVerifier,
  IdentityRepository,
  Locale,
  Mailer,
  NewUser,
  PasswordHasher,
} from './application/ports'
export { signup, SIGNUP_PER_IP, TERMS_VERSION } from './application/signup'
export { verifyEmail } from './application/verify-email'
export { joinWaitlist } from './application/join-waitlist'
export { argon2idHasher } from './infrastructure/argon2id-hasher'
export { drizzleIdentityRepository, purgeExpiredEmailTokens } from './infrastructure/drizzle-identity-repository'
export { hibpBreachChecker } from './infrastructure/hibp-breach-checker'
export { fakeMailer, resendMailer } from './infrastructure/resend-mailer'
export { fakeHumanVerifier, turnstileVerifier, TURNSTILE_DUMMY_TOKEN } from './infrastructure/turnstile-verifier'
export { emailsConsumer } from './interface/emails-consumer'
export { orThrow } from './interface/identity-http'
