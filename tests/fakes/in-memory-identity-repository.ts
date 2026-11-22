import type {
  BetaInvite,
  EmailToken,
  IdentityRepository,
  Locale,
  NewSession,
  NewUser,
} from '../../server/modules/identity'

type StoredUser = Omit<NewUser, 'passwordHash'> & {
  passwordHash: string | null
  emailVerifiedAt: Date | null
  role: 'user' | 'moderator' | 'admin'
  status: string
}

/** In-memory IdentityRepository with the same case-insensitive uniqueness as the database indexes. */
export function inMemoryIdentityRepository() {
  const users: StoredUser[] = []
  const tokens: EmailToken[] = []
  const sessions: (NewSession & { createdAt: Date; revokedAt: Date | null })[] = []
  const active = (userId: string, at: Date) =>
    sessions.filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > at)
  const invites: (BetaInvite & { usedAt: Date | null })[] = []
  const waitlist: { id: string; email: string; locale: Locale }[] = []
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const repo: IdentityRepository = {
    async findUserIdByEmail(email) {
      return users.find((u) => same(u.email, email))?.id ?? null
    },
    async usernameTaken(username) {
      return users.some((u) => same(u.username, username))
    },
    async createUser(user) {
      if (users.some((u) => same(u.email, user.email))) return 'email_taken'
      if (users.some((u) => same(u.username, user.username))) return 'username_taken'
      users.push({ ...user, emailVerifiedAt: null, role: 'user', status: 'active' })
      return 'created'
    },
    async findRecipient(userId) {
      const user = users.find((u) => u.id === userId)
      return user ? { email: user.email, username: user.username, locale: user.locale } : null
    },
    async createEmailToken(token) {
      tokens.push({ ...token, usedAt: null })
    },
    async findEmailToken(tokenHash, type) {
      const token = tokens.find((t) => t.tokenHash === tokenHash && t.type === type)
      return token ? { ...token } : null
    },
    async useEmailToken(id, at) {
      const token = tokens.find((t) => t.id === id && !t.usedAt)
      if (token) token.usedAt = at
      return Boolean(token)
    },
    async markEmailVerified(userId, at) {
      const user = users.find((u) => u.id === userId)
      if (user) user.emailVerifiedAt = at
    },
    async findCredentials(email) {
      const user = users.find((u) => same(u.email, email))
      return user ? { userId: user.id, passwordHash: user.passwordHash, status: user.status } : null
    },
    async createSession(session) {
      sessions.push({ ...session, createdAt: session.lastSeenAt, revokedAt: null })
    },
    async findSession(idHash) {
      const session = sessions.find((s) => s.idHash === idHash)
      const user = users.find((u) => u.id === session?.userId)
      if (!session || !user) return null
      const { id, username, role, status } = user
      return {
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        account: { id, username, role, status, emailVerified: Boolean(user.emailVerifiedAt) },
      }
    },
    async touchSession(idHash, lastSeenAt, expiresAt) {
      const session = sessions.find((s) => s.idHash === idHash)
      if (session) Object.assign(session, { lastSeenAt, expiresAt })
    },
    async revokeSession(idHash, at) {
      const session = sessions.find((s) => s.idHash === idHash && !s.revokedAt)
      if (session) session.revokedAt = at
    },
    async listSessions(userId, at) {
      return active(userId, at)
        .toSorted((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .map(({ idHash, createdAt, lastSeenAt, userAgentSummary }) => ({
          idHash,
          createdAt,
          lastSeenAt,
          userAgentSummary,
        }))
    },
    async revokeUserSession(userId, idHash, at) {
      const session = active(userId, at).find((s) => s.idHash === idHash)
      if (session) session.revokedAt = at
      return Boolean(session)
    },
    async revokeOtherSessions(userId, keptIdHash, at) {
      for (const s of active(userId, at)) if (s.idHash !== keptIdHash) s.revokedAt = at
    },
    async createInvite(invite) {
      invites.push({ ...invite, usedAt: null })
    },
    async findUsableInvite(tokenHash, at) {
      return invites.find((i) => i.tokenHash === tokenHash && !i.usedAt && i.expiresAt > at)?.id ?? null
    },
    async useInvite(id, at) {
      const invite = invites.find((i) => i.id === id && !i.usedAt)
      if (invite) invite.usedAt = at
      return Boolean(invite)
    },
    async joinWaitlist(entry) {
      if (!waitlist.some((e) => same(e.email, entry.email))) waitlist.push(entry)
    },
  }
  return { repo, users, tokens, sessions, invites, waitlist }
}
