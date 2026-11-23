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
  /** null: OAuth account whose provider gave no verified email */
  email: string | null
  username: string
  /** null: OAuth account (a password can be set by reset, Q52) */
  passwordHash: string | null
  /** Set for an email verified by the OAuth provider (US-02.1). */
  emailVerifiedAt?: Date
  locale: Locale
  termsAcceptedAt: Date
  termsVersion: string
}

export type OAuthProviderName = 'google'

/** Identity given by an OAuth provider; `email` only when the provider verified it (08-securite.md § 3). */
export interface OAuthIdentity {
  subject: string
  email: string | null
}

/** Port: OAuth provider, authorization code flow with PKCE S256 (08-securite.md § 3). */
export interface OAuthProvider {
  authorizationUrl(params: { state: string; codeChallenge: string; redirectUri: string }): string
  /** Exchanges the code; rejects when the provider refuses it or answers out of contract. */
  identity(params: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthIdentity>
}

export interface EmailToken {
  id: string
  userId: string
  type: EmailTokenType
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
}

/** Beta invitation (US-56.4): only the hash of its token and a keyed fingerprint of the email are stored. */
export interface BetaInvite {
  id: string
  emailHmac: string
  tokenHash: string
  invitedBy: string | null
  expiresAt: Date
}

/** Member behind a session (re-read at each request: a ban applies at once, 08-securite.md § 4). */
export interface Actor {
  id: string
  username: string
  role: 'user' | 'moderator' | 'admin'
  status: string
  emailVerified: boolean
}

export interface NewSession {
  /** SHA-256 of the 256-bit id carried by the sealed cookie (ADR-010). */
  idHash: string
  userId: string
  lastSeenAt: Date
  expiresAt: Date
  userAgentSummary: string | null
}

export interface SessionSummary {
  idHash: string
  createdAt: Date
  lastSeenAt: Date
  userAgentSummary: string | null
}

/** Port: accounts, email tokens, sessions, beta invitations and waiting list. Email and username comparisons ignore case. */
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
  /** Marks every unused token of this type of `userId` used (US-04.5: the other reset links after a reset). */
  useEmailTokens(userId: string, type: EmailTokenType, at: Date): Promise<void>
  markEmailVerified(userId: string, at: Date): Promise<void>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
  findCredentials(email: string): Promise<{ userId: string; passwordHash: string | null; status: string } | null>
  /** Public fields of the account of `username`, ignoring case; `username` in its display case. */
  findProfile(
    username: string,
  ): Promise<{ username: string; bio: string | null; createdAt: Date; status: string } | null>
  findOAuthAccount(provider: OAuthProviderName, subject: string): Promise<{ userId: string; status: string } | null>
  /** `false` (nothing written) when this identity is already linked. */
  linkOAuthAccount(link: { id: string; userId: string; provider: OAuthProviderName; subject: string }): Promise<boolean>
  createSession(session: NewSession): Promise<void>
  findSession(
    idHash: string,
  ): Promise<{ lastSeenAt: Date; expiresAt: Date; revokedAt: Date | null; account: Actor } | null>
  touchSession(idHash: string, lastSeenAt: Date, expiresAt: Date): Promise<void>
  revokeSession(idHash: string, at: Date): Promise<void>
  /** Sessions of `userId` neither revoked nor expired at `at`, latest activity first (US-03.7). */
  listSessions(userId: string, at: Date): Promise<SessionSummary[]>
  /** Revokes an active session of `userId`; `false` when none matches (another member's, unknown or ended). */
  revokeUserSession(userId: string, idHash: string, at: Date): Promise<boolean>
  revokeOtherSessions(userId: string, keptIdHash: string, at: Date): Promise<void>
  createInvite(invite: BetaInvite): Promise<void>
  /** Id of the invitation of this token if it is unused and not expired at `at`. */
  findUsableInvite(tokenHash: string, at: Date): Promise<string | null>
  /** Marks the invitation used; `false` if it already was (concurrent use). */
  useInvite(id: string, at: Date): Promise<boolean>
  /** Does nothing for an email already on the list. */
  joinWaitlist(entry: { id: string; email: string; locale: Locale }): Promise<void>
}
