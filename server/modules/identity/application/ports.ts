/** Port: password hashing (ADR-015). `needsRehash`: stored with older parameters, rehash at sign-in. */
export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, stored: string): Promise<{ valid: boolean; needsRehash: boolean }>
}

/** Port: is the password in a known breach (HIBP, k-anonymity; 08-securite.md § 3). */
export interface BreachChecker {
  isBreached(password: string): Promise<boolean>
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
}

/** Port: transactional emails (Resend). Rejects when the provider refuses the message. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>
}

/**
 * Port: anti-bot check of a form (Turnstile siteverify). `false` for a missing, invalid or reused token, or one
 * solved for another form (`action`: the `data-action` of the widget).
 */
export interface HumanVerifier {
  verify(token: string, ip: string | undefined, action: string): Promise<boolean>
}

export type Locale = 'en' | 'fr'
export type EmailTokenType = 'verify' | 'reset' | 'email_change' | 'deletion_cancel'

export interface NewUser {
  id: string
  email: string
  username: string
  passwordHash: string
  locale: Locale
  termsAcceptedAt: Date
  termsVersion: string
}

export interface EmailToken {
  id: string
  userId: string
  type: EmailTokenType
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
}

/** Port: accounts and email tokens. Email and username comparisons ignore case. */
export interface IdentityRepository {
  findUserIdByEmail(email: string): Promise<string | null>
  usernameTaken(username: string): Promise<boolean>
  /** `email_taken` / `username_taken`: a concurrent sign-up won the unique index. */
  createUser(user: NewUser): Promise<'created' | 'email_taken' | 'username_taken'>
  findRecipient(userId: string): Promise<{ email: string; username: string; locale: Locale } | null>
  createEmailToken(token: Omit<EmailToken, 'usedAt'>): Promise<void>
  findEmailToken(tokenHash: string, type: EmailTokenType): Promise<EmailToken | null>
  /** Marks the token used; `false` if it already was (concurrent use). */
  useEmailToken(id: string, at: Date): Promise<boolean>
  markEmailVerified(userId: string, at: Date): Promise<void>
}
