import { and, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import type { Clock } from '../../../platform/clock'
import {
  betaInvites,
  emailTokens,
  mfaRecoveryCodes,
  oauthAccounts,
  sessions,
  usernameRedirects,
  userSocialLinks,
  users,
  waitlistEntries,
} from '../../../db/schema'
import { notificationPrefs } from '../../../../shared/domain/notification-prefs'
import { SOCIAL_PLATFORMS } from '../../../../shared/domain/social-links'
import type { Actor, EmailTokenType, IdentityRepository, Locale, SocialLink } from '../application/ports'

const inPlatformOrder = (links: SocialLink[]) =>
  links.sort((a, b) => SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform))

const sameEmail = (email: string) => sql`lower(${users.email}) = lower(${email})`
const activeOf = (userId: string, at: Date) =>
  and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, at))

/** users and email_tokens tables; uniqueness ignoring case comes from the lower(…) indexes. */
export const drizzleIdentityRepository = (db: Db | Transaction): IdentityRepository => ({
  async findUserIdByEmail(email) {
    const [row] = await db.select({ id: users.id }).from(users).where(sameEmail(email))
    return row?.id ?? null
  },
  async usernameTaken(username) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
    return rows.length > 0
  },
  async createUser(user) {
    // Do nothing on conflict: a unique violation would abort the caller's transaction
    const inserted = await db.insert(users).values(user).onConflictDoNothing().returning({ id: users.id })
    if (inserted.length) return 'created'
    return user.email && (await this.findUserIdByEmail(user.email)) ? 'email_taken' : 'username_taken'
  },
  async findRecipient(userId) {
    const [row] = await db
      .select({ email: users.email, username: users.username, locale: users.locale, prefs: users.notificationPrefs })
      .from(users)
      .where(eq(users.id, userId))
    if (!row) return null
    const { prefs, ...recipient } = row
    return { ...recipient, locale: row.locale as Locale, notificationPrefs: notificationPrefs(prefs) }
  },
  async createEmailToken(token) {
    await db.insert(emailTokens).values(token)
  },
  async findEmailToken(tokenHash, type) {
    const [row] = await db
      .select({
        id: emailTokens.id,
        userId: emailTokens.userId,
        type: emailTokens.type,
        tokenHash: emailTokens.tokenHash,
        expiresAt: emailTokens.expiresAt,
        usedAt: emailTokens.usedAt,
        newEmail: emailTokens.newEmail,
      })
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, type)))
    return row ? { ...row, type: row.type as EmailTokenType } : null
  },
  async useEmailToken(id, at) {
    const updated = await db
      .update(emailTokens)
      .set({ usedAt: at })
      .where(and(eq(emailTokens.id, id), isNull(emailTokens.usedAt)))
      .returning({ id: emailTokens.id })
    return updated.length > 0
  },
  async useEmailTokens(userId, type, at) {
    await db
      .update(emailTokens)
      .set({ usedAt: at })
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type), isNull(emailTokens.usedAt)))
  },
  async markEmailVerified(userId, at) {
    await db.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, userId))
  },
  async setEmail(userId, email, verifiedAt) {
    await db.update(users).set({ email, emailVerifiedAt: verifiedAt }).where(eq(users.id, userId))
  },
  async setPasswordHash(userId, passwordHash) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  },
  async findProfile(username) {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        createdAt: users.createdAt,
        status: users.status,
      })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
    if (!row) return null
    const { id, ...profile } = row
    const links = await db
      .select({ platform: userSocialLinks.platform, handle: userSocialLinks.handle })
      .from(userSocialLinks)
      .where(eq(userSocialLinks.userId, id))
    return { ...profile, socialLinks: inPlatformOrder(links as SocialLink[]) }
  },
  async updateProfile(userId, { notificationPrefs: prefs, ...fields }) {
    const set = {
      ...fields,
      ...(prefs && { notificationPrefs: sql`${users.notificationPrefs} || ${JSON.stringify(prefs)}::jsonb` }),
    }
    if (Object.keys(set).length) await db.update(users).set(set).where(eq(users.id, userId))
  },
  async setSocialLinks(userId, links) {
    await db.delete(userSocialLinks).where(eq(userSocialLinks.userId, userId))
    if (links.length) await db.insert(userSocialLinks).values(links.map((link) => ({ userId, ...link })))
  },
  async findUsername(userId) {
    const [row] = await db
      .select({ username: users.username, changedAt: users.usernameChangedAt })
      .from(users)
      .where(eq(users.id, userId))
    return row ?? null
  },
  async findAvatar(userId) {
    const [row] = await db
      .select({ current: users.avatarKey, pending: users.avatarPendingKey })
      .from(users)
      .where(eq(users.id, userId))
    return row ?? null
  },
  async setPendingAvatar(userId, version) {
    await db.update(users).set({ avatarPendingKey: version }).where(eq(users.id, userId))
  },
  async promoteAvatar(userId, version) {
    // The current version read in the same statement (CTE): a concurrent promotion cannot slip in between
    const rows = await db.execute<{ previous: string | null }>(sql`
      with old as (select avatar_key from users where id = ${userId} and avatar_pending_key = ${version} for update)
      update users set avatar_key = ${version}, avatar_pending_key = null
      from old where users.id = ${userId} and users.avatar_pending_key = ${version}
      returning old.avatar_key as previous`)
    const [row] = Array.from(rows)
    return row ? { previous: row.previous } : false
  },
  async dropPendingAvatar(userId, version) {
    const rows = await db
      .update(users)
      .set({ avatarPendingKey: null })
      .where(and(eq(users.id, userId), eq(users.avatarPendingKey, version)))
      .returning({ id: users.id })
    return rows.length > 0
  },
  async usernames(ids) {
    if (!ids.length) return new Map()
    const rows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(inArray(users.id, ids), notInArray(users.status, ['banned', 'pending_deletion'])))
    return new Map(rows.map((r) => [r.id, r.username]))
  },
  async usernameOwner(username, at) {
    const [holder] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
    if (holder) return holder.id
    const [redirect] = await db
      .select({ userId: usernameRedirects.userId })
      .from(usernameRedirects)
      .where(and(eq(usernameRedirects.oldUsername, username.toLowerCase()), gt(usernameRedirects.expiresAt, at)))
    return redirect?.userId ?? null
  },
  async renameUser({ userId, previous, username, at, redirectUntil }) {
    await db.update(users).set({ username, usernameChangedAt: at }).where(eq(users.id, userId))
    await db.delete(usernameRedirects).where(eq(usernameRedirects.oldUsername, username.toLowerCase()))
    if (previous.toLowerCase() === username.toLowerCase()) return
    await db
      .insert(usernameRedirects)
      .values({ oldUsername: previous.toLowerCase(), userId, expiresAt: redirectUntil })
      .onConflictDoUpdate({ target: usernameRedirects.oldUsername, set: { userId, expiresAt: redirectUntil } })
  },
  async findCredentials(email) {
    const [row] = await db
      .select({ userId: users.id, passwordHash: users.passwordHash, status: users.status })
      .from(users)
      .where(sameEmail(email))
    return row ?? null
  },
  async findOAuthAccount(provider, subject) {
    const [row] = await db
      .select({ userId: users.id, status: users.status })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, subject)))
    return row ?? null
  },
  async linkOAuthAccount({ id, userId, provider, subject }) {
    const inserted = await db
      .insert(oauthAccounts)
      .values({ id, userId, provider, providerUserId: subject })
      .onConflictDoNothing()
      .returning({ id: oauthAccounts.id })
    return inserted.length > 0
  },
  async listOAuthProviders(userId) {
    const rows = await db
      .select({ provider: oauthAccounts.provider })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId))
    const linked = new Set(rows.map((r) => r.provider))
    return (['google', 'battlenet'] as const).filter((p) => linked.has(p))
  },
  async unlinkOAuthAccount(userId, provider) {
    const deleted = await db
      .delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
      .returning({ id: oauthAccounts.id })
    return deleted.length > 0
  },
  async createSession(session) {
    await db.insert(sessions).values(session)
  },
  async findSession(idHash) {
    const [row] = await db
      .select({
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        mfaVerifiedAt: sessions.mfaVerifiedAt,
        id: users.id,
        username: users.username,
        role: users.role,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.idHash, idHash))
    if (!row) return null
    const { id, username, role, status, emailVerifiedAt, ...session } = row
    const account = { id, username, role: role as Actor['role'], status, emailVerified: Boolean(emailVerifiedAt) }
    return { ...session, account }
  },
  async touchSession(idHash, lastSeenAt, expiresAt) {
    await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.idHash, idHash))
  },
  async revokeSession(idHash, at) {
    await db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(eq(sessions.idHash, idHash), isNull(sessions.revokedAt)))
  },
  async listSessions(userId, at) {
    return db
      .select({
        idHash: sessions.idHash,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        userAgentSummary: sessions.userAgentSummary,
      })
      .from(sessions)
      .where(activeOf(userId, at))
      .orderBy(desc(sessions.lastSeenAt))
  },
  async revokeUserSession(userId, idHash, at) {
    const revoked = await db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(activeOf(userId, at), eq(sessions.idHash, idHash)))
      .returning({ idHash: sessions.idHash })
    return revoked.length > 0
  },
  async revokeOtherSessions(userId, keptIdHash, at) {
    await db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(activeOf(userId, at), ne(sessions.idHash, keptIdHash)))
  },
  async findMfa(userId) {
    const [row] = await db
      .select({ secretEnc: users.mfaTotpSecretEnc, enabledAt: users.mfaEnabledAt, lastStep: users.mfaLastStep })
      .from(users)
      .where(eq(users.id, userId))
    return row ?? null
  },
  async setPendingMfa(userId, secretEnc) {
    await db
      .update(users)
      .set({ mfaTotpSecretEnc: secretEnc })
      .where(and(eq(users.id, userId), isNull(users.mfaEnabledAt)))
  },
  async enableMfa(userId, { at, step, codeHashes }) {
    await db.update(users).set({ mfaEnabledAt: at, mfaLastStep: step }).where(eq(users.id, userId))
    await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId))
    await db.insert(mfaRecoveryCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })))
  },
  async useTotpStep(userId, step) {
    const rows = await db
      .update(users)
      .set({ mfaLastStep: step })
      .where(and(eq(users.id, userId), or(isNull(users.mfaLastStep), lt(users.mfaLastStep, step))))
      .returning({ id: users.id })
    return rows.length > 0
  },
  async useRecoveryCode(userId, codeHash, at) {
    const rows = await db
      .update(mfaRecoveryCodes)
      .set({ usedAt: at })
      .where(
        and(
          eq(mfaRecoveryCodes.userId, userId),
          eq(mfaRecoveryCodes.codeHash, codeHash),
          isNull(mfaRecoveryCodes.usedAt),
        ),
      )
      .returning({ userId: mfaRecoveryCodes.userId })
    return rows.length > 0
  },
  async createInvite(invite) {
    await db.insert(betaInvites).values(invite)
  },
  async findUsableInvite(tokenHash, at) {
    const [row] = await db
      .select({ id: betaInvites.id })
      .from(betaInvites)
      .where(and(eq(betaInvites.tokenHash, tokenHash), isNull(betaInvites.usedAt), gt(betaInvites.expiresAt, at)))
    return row?.id ?? null
  },
  async useInvite(id, at) {
    const updated = await db
      .update(betaInvites)
      .set({ usedAt: at })
      .where(and(eq(betaInvites.id, id), isNull(betaInvites.usedAt)))
      .returning({ id: betaInvites.id })
    return updated.length > 0
  },
  async joinWaitlist(entry) {
    await db.insert(waitlistEntries).values(entry).onConflictDoNothing() // lower(email) unique index
  },
})

/** Hourly purge of the expired email tokens and sessions, revoked ones included (03-architecture.md § Crons). */
export async function purgeExpiredTokens(db: Db, clock: Clock): Promise<void> {
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, clock.now()))
  await db.delete(sessions).where(lt(sessions.expiresAt, clock.now()))
}

/** Daily cron (03-architecture.md § Cron): former usernames past their 90 days (US-05.4). Idempotent. */
export async function purgeExpiredRedirects(db: Db, clock: Clock): Promise<void> {
  await db.delete(usernameRedirects).where(lt(usernameRedirects.expiresAt, clock.now()))
}
