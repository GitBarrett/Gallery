import { and, desc, eq, gt, isNull, lt, ne, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import type { Clock } from '../../../platform/clock'
import { betaInvites, emailTokens, sessions, users, waitlistEntries } from '../../../db/schema'
import type { Actor, EmailTokenType, IdentityRepository, Locale } from '../application/ports'

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
    return (await this.findUserIdByEmail(user.email)) ? 'email_taken' : 'username_taken'
  },
  async findRecipient(userId) {
    const [row] = await db
      .select({ email: users.email, username: users.username, locale: users.locale })
      .from(users)
      .where(eq(users.id, userId))
    return row?.email ? { email: row.email, username: row.username, locale: row.locale as Locale } : null
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
  async markEmailVerified(userId, at) {
    await db.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, userId))
  },
  async setPasswordHash(userId, passwordHash) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  },
  async findCredentials(email) {
    const [row] = await db
      .select({ userId: users.id, passwordHash: users.passwordHash, status: users.status })
      .from(users)
      .where(sameEmail(email))
    return row ?? null
  },
  async createSession(session) {
    await db.insert(sessions).values(session)
  },
  async findSession(idHash) {
    const [row] = await db
      .select({
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
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
    const { lastSeenAt, expiresAt, revokedAt, id, username, role, status, emailVerifiedAt } = row
    const account = { id, username, role: role as Actor['role'], status, emailVerified: Boolean(emailVerifiedAt) }
    return { lastSeenAt, expiresAt, revokedAt, account }
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
