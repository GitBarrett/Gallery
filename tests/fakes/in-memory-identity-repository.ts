import type {
  BetaInvite,
  EmailToken,
  IdentityRepository,
  Locale,
  MfaState,
  NewSession,
  NewUser,
  SocialLink,
} from '../../server/modules/identity'
import { notificationPrefs, type NotificationPrefs } from '../../shared/domain/notification-prefs'
import { SOCIAL_PLATFORMS } from '../../shared/domain/social-links'

type StoredUser = Omit<NewUser, 'passwordHash' | 'emailVerifiedAt'> & {
  passwordHash: string | null
  emailVerifiedAt: Date | null
  role: 'user' | 'moderator' | 'admin'
  status: string
  // set by the tests that need them (not written by createUser, so that its rows compare simply)
  usernameChangedAt?: Date | null
  bio?: string | null
  notificationPrefs?: Partial<NotificationPrefs>
  createdAt?: Date
  mfa?: MfaState
  avatar?: { current: string | null; pending: string | null }
}

/** In-memory IdentityRepository with the same case-insensitive uniqueness as the database indexes. */
export function inMemoryIdentityRepository() {
  const users: StoredUser[] = []
  const tokens: EmailToken[] = []
  const sessions: (NewSession & { createdAt: Date; revokedAt: Date | null })[] = []
  const recoveryCodes: { userId: string; codeHash: string; usedAt: Date | null }[] = []
  const mfaOf = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (user) user.mfa ??= { secretEnc: null, enabledAt: null, lastStep: null }
    return user?.mfa
  }
  const active = (userId: string, at: Date) =>
    sessions.filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > at)
  const invites: (BetaInvite & { usedAt: Date | null })[] = []
  const waitlist: { id: string; email: string; locale: Locale }[] = []
  const same = (a: string | null, b: string) => a?.toLowerCase() === b.toLowerCase()
  const oauth: { id: string; userId: string; provider: string; subject: string }[] = []
  let socials: (SocialLink & { userId: string })[] = []
  const redirects: { oldUsername: string; userId: string; expiresAt: Date }[] = []
  const repo: IdentityRepository = {
    async findUserIdByEmail(email) {
      return users.find((u) => same(u.email, email))?.id ?? null
    },
    async usernameTaken(username) {
      return users.some((u) => same(u.username, username))
    },
    async createUser(user) {
      const { email } = user
      if (email && users.some((u) => same(u.email, email))) return 'email_taken'
      if (users.some((u) => same(u.username, user.username))) return 'username_taken'
      users.push({ ...user, emailVerifiedAt: user.emailVerifiedAt ?? null, role: 'user', status: 'active' })
      return 'created'
    },
    async findRecipient(userId) {
      const user = users.find((u) => u.id === userId)
      return user
        ? {
            email: user.email,
            username: user.username,
            locale: user.locale,
            notificationPrefs: notificationPrefs(user.notificationPrefs),
          }
        : null
    },
    async createEmailToken(token) {
      tokens.push({ ...token, newEmail: token.newEmail ?? null, usedAt: null })
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
    async useEmailTokens(userId, type, at) {
      for (const t of tokens) if (t.userId === userId && t.type === type && !t.usedAt) t.usedAt = at
    },
    async markEmailVerified(userId, at) {
      const user = users.find((u) => u.id === userId)
      if (user) user.emailVerifiedAt = at
    },
    async setEmail(userId, email, verifiedAt) {
      const user = users.find((u) => u.id === userId)
      if (user) Object.assign(user, { email, emailVerifiedAt: verifiedAt })
    },
    async setPasswordHash(userId, passwordHash) {
      const user = users.find((u) => u.id === userId)
      if (user) user.passwordHash = passwordHash
    },
    async findProfile(username) {
      const user = users.find((u) => same(u.username, username))
      return user
        ? {
            id: user.id,
            avatar: user.avatar?.current ?? null,
            username: user.username,
            bio: user.bio ?? null,
            createdAt: user.createdAt ?? new Date(0),
            status: user.status,
            socialLinks: socials
              .filter((l) => l.userId === user.id)
              .map(({ platform, handle }) => ({ platform, handle }))
              .sort((a, b) => SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform)),
          }
        : null
    },
    async updateProfile(userId, fields) {
      const user = users.find((u) => u.id === userId)
      const { notificationPrefs: prefs, ...rest } = fields
      if (user) Object.assign(user, rest, prefs && { notificationPrefs: { ...user.notificationPrefs, ...prefs } })
    },
    async setSocialLinks(userId, links) {
      socials = [...socials.filter((l) => l.userId !== userId), ...links.map((link) => ({ userId, ...link }))]
    },
    async findAvatar(userId) {
      const user = users.find((u) => u.id === userId)
      return user ? (user.avatar ?? { current: null, pending: null }) : null
    },
    async setPendingAvatar(userId, version) {
      const user = users.find((u) => u.id === userId)
      if (user) user.avatar = { current: user.avatar?.current ?? null, pending: version }
    },
    async promoteAvatar(userId, version) {
      const user = users.find((u) => u.id === userId)
      if (user?.avatar?.pending !== version) return false
      const previous = user.avatar.current
      user.avatar = { current: version, pending: null }
      return { previous }
    },
    async dropPendingAvatar(userId, version) {
      const user = users.find((u) => u.id === userId)
      if (user?.avatar?.pending !== version) return false
      user.avatar.pending = null
      return true
    },
    async usernames(ids) {
      const found = users.filter((u) => ids.includes(u.id) && !['banned', 'pending_deletion'].includes(u.status))
      return new Map(found.map((u) => [u.id, u.username]))
    },
    async findUsername(userId) {
      const user = users.find((u) => u.id === userId)
      return user ? { username: user.username, changedAt: user.usernameChangedAt ?? null } : null
    },
    async usernameOwner(username, at) {
      const holder = users.find((u) => same(u.username, username))
      return holder?.id ?? redirects.find((r) => same(r.oldUsername, username) && r.expiresAt > at)?.userId ?? null
    },
    async renameUser({ userId, previous, username, at, redirectUntil }) {
      const user = users.find((u) => u.id === userId)!
      Object.assign(user, { username, usernameChangedAt: at })
      const kept = redirects.filter((r) => !same(r.oldUsername, username) && !same(r.oldUsername, previous))
      if (!same(previous, username))
        kept.push({ oldUsername: previous.toLowerCase(), userId, expiresAt: redirectUntil })
      redirects.splice(0, redirects.length, ...kept)
    },
    async findCredentials(email) {
      const user = users.find((u) => same(u.email, email))
      return user ? { userId: user.id, passwordHash: user.passwordHash, status: user.status } : null
    },
    async findOAuthAccount(provider, subject) {
      const link = oauth.find((o) => o.provider === provider && o.subject === subject)
      const user = users.find((u) => u.id === link?.userId)
      return user ? { userId: user.id, status: user.status } : null
    },
    async linkOAuthAccount(link) {
      if (oauth.some((o) => o.provider === link.provider && o.subject === link.subject)) return false
      oauth.push(link)
      return true
    },
    async listOAuthProviders(userId) {
      return (['google', 'battlenet'] as const).filter((p) =>
        oauth.some((o) => o.userId === userId && o.provider === p),
      )
    },
    async unlinkOAuthAccount(userId, provider) {
      const index = oauth.findIndex((o) => o.userId === userId && o.provider === provider)
      if (index >= 0) oauth.splice(index, 1)
      return index >= 0
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
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        mfaVerifiedAt: session.mfaVerifiedAt ?? null,
        account: {
          id,
          username,
          role,
          status,
          emailVerified: Boolean(user.emailVerifiedAt),
          avatar: user.avatar?.current ?? null,
        },
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
    async findMfa(userId) {
      const mfa = mfaOf(userId)
      return mfa ? { ...mfa } : null
    },
    async setPendingMfa(userId, secretEnc) {
      const mfa = mfaOf(userId)
      if (mfa && !mfa.enabledAt) mfa.secretEnc = secretEnc
    },
    async enableMfa(userId, { at, step, codeHashes }) {
      Object.assign(mfaOf(userId)!, { enabledAt: at, lastStep: step })
      for (let i = recoveryCodes.length - 1; i >= 0; i--)
        if (recoveryCodes[i]!.userId === userId) recoveryCodes.splice(i, 1)
      for (const codeHash of codeHashes) recoveryCodes.push({ userId, codeHash, usedAt: null })
    },
    async useTotpStep(userId, step) {
      const mfa = mfaOf(userId)
      if (!mfa || step <= (mfa.lastStep ?? -1)) return false
      mfa.lastStep = step
      return true
    },
    async useRecoveryCode(userId, codeHash, at) {
      const code = recoveryCodes.find((c) => c.userId === userId && c.codeHash === codeHash && !c.usedAt)
      if (code) code.usedAt = at
      return Boolean(code)
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
  return { repo, users, tokens, sessions, invites, waitlist, oauth }
}
