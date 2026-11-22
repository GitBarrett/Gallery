// identity module (03-architecture.md § Modules): accounts, passwords, emails. Routes and use cases: T-11b.
export type { BreachChecker, EmailMessage, Mailer, PasswordHasher } from './application/ports'
export { argon2idHasher } from './infrastructure/argon2id-hasher'
export { hibpBreachChecker } from './infrastructure/hibp-breach-checker'
export { resendMailer } from './infrastructure/resend-mailer'
