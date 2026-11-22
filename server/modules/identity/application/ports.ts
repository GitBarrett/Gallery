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
