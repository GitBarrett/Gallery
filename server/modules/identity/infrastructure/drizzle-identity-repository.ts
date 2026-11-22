import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import type { Clock } from '../../../platform/clock'
import { emailTokens, users } from '../../../db/schema'
import type { EmailTokenType, IdentityRepository, Locale } from '../application/ports'

const sameEmail = (email: string) => sql`lower(${users.email}) = lower(${email})`

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
})

/** Hourly purge of the expired email tokens (03-architecture.md § Crons). */
export async function purgeExpiredEmailTokens(db: Db, clock: Clock): Promise<void> {
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, clock.now()))
}
