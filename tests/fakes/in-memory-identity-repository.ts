import type { BetaInvite, EmailToken, IdentityRepository, Locale, NewUser } from '../../server/modules/identity'

/** In-memory IdentityRepository with the same case-insensitive uniqueness as the database indexes. */
export function inMemoryIdentityRepository() {
  const users: (NewUser & { emailVerifiedAt: Date | null })[] = []
  const tokens: EmailToken[] = []
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
      users.push({ ...user, emailVerifiedAt: null })
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
  return { repo, users, tokens, invites, waitlist }
}
