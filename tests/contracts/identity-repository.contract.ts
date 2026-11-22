import { describe, expect, it } from 'vitest'
import type { IdentityRepository, NewUser } from '../../server/modules/identity'

// Contract of the IdentityRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `make` returns an empty repository (or one where the run's unique values are unused).
export function identityRepositoryContract(name: string, make: () => Promise<IdentityRepository>) {
  const user = (): NewUser => {
    const run = crypto.randomUUID().slice(0, 8)
    return {
      id: crypto.randomUUID(),
      email: `Ash.${run}@Example.com`,
      username: `Ash_${run}`,
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA',
      locale: 'fr',
      termsAcceptedAt: new Date('2026-11-22T12:00:00Z'),
      termsVersion: '2026-11-22',
    }
  }
  const token = (userId: string) => ({
    id: crypto.randomUUID(),
    userId,
    type: 'verify' as const,
    tokenHash: crypto.randomUUID(),
    expiresAt: new Date('2026-11-23T12:00:00Z'),
  })

  describe(`IdentityRepository contract: ${name}`, () => {
    it('finds a user by email and username ignoring case', async () => {
      const repo = await make()
      const ash = user()
      expect(await repo.createUser(ash)).toBe('created')
      expect(await repo.findUserIdByEmail(ash.email.toUpperCase())).toBe(ash.id)
      expect(await repo.usernameTaken(ash.username.toLowerCase())).toBe(true)
      expect(await repo.findUserIdByEmail(`other.${ash.email}`)).toBeNull()
      expect(await repo.usernameTaken(`${ash.username}x`)).toBe(false)
      expect(await repo.findRecipient(ash.id)).toEqual({ email: ash.email, username: ash.username, locale: 'fr' })
    })

    it('refuses a second account with the same email or username in another case', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const other = user()
      expect(await repo.createUser({ ...other, email: ash.email.toLowerCase() })).toBe('email_taken')
      expect(await repo.createUser({ ...other, username: ash.username.toUpperCase() })).toBe('username_taken')
    })

    it('uses an email token once and verifies the email', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const t = token(ash.id)
      await repo.createEmailToken(t)
      expect(await repo.findEmailToken(t.tokenHash, 'reset')).toBeNull()
      expect(await repo.findEmailToken(t.tokenHash, 'verify')).toEqual({ ...t, usedAt: null })
      const now = new Date('2026-11-22T13:00:00Z')
      expect(await repo.useEmailToken(t.id, now)).toBe(true)
      expect(await repo.useEmailToken(t.id, now)).toBe(false)
      expect((await repo.findEmailToken(t.tokenHash, 'verify'))?.usedAt).toEqual(now)
      await repo.markEmailVerified(ash.id, now)
    })

    it('US-04.3 replaces the password hash of an account', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      await repo.setPasswordHash(ash.id, '$argon2id$new')
      expect((await repo.findCredentials(ash.email))?.passwordHash).toBe('$argon2id$new')
    })

    it('US-04.5 uses every unused token of a kind of an account, and only those', async () => {
      const repo = await make()
      const [ash, thrall] = [user(), user()]
      await repo.createUser(ash)
      await repo.createUser(thrall)
      const now = new Date('2026-11-22T12:00:00Z')
      const reset = { ...token(ash.id), type: 'reset' as const }
      const verify = token(ash.id)
      const other = { ...token(thrall.id), type: 'reset' as const }
      for (const t of [reset, verify, other]) await repo.createEmailToken(t)
      await repo.useEmailTokens(ash.id, 'reset', now)
      expect((await repo.findEmailToken(reset.tokenHash, 'reset'))?.usedAt).toEqual(now)
      expect((await repo.findEmailToken(verify.tokenHash, 'verify'))?.usedAt).toBeNull()
      expect((await repo.findEmailToken(other.tokenHash, 'reset'))?.usedAt).toBeNull()
    })

    it('US-03.1 finds the credentials of an email in any case', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      expect(await repo.findCredentials(ash.email.toUpperCase())).toEqual({
        userId: ash.id,
        passwordHash: ash.passwordHash,
        status: 'active',
      })
      expect(await repo.findCredentials(`other.${ash.email}`)).toBeNull()
    })

    it('US-03.1 stores a session with its account, slides it and revokes it', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const at = new Date('2026-11-22T12:00:00Z')
      const session = {
        idHash: crypto.randomUUID(),
        userId: ash.id,
        lastSeenAt: at,
        expiresAt: new Date('2026-12-22T12:00:00Z'),
        userAgentSummary: 'Firefox',
      }
      await repo.createSession(session)
      const account = { id: ash.id, username: ash.username, role: 'user', status: 'active', emailVerified: false }
      expect(await repo.findSession(session.idHash)).toEqual({
        lastSeenAt: at,
        expiresAt: session.expiresAt,
        revokedAt: null,
        account,
      })
      const later = new Date('2026-11-23T12:00:00Z')
      await repo.touchSession(session.idHash, later, new Date('2026-12-23T12:00:00Z'))
      expect(await repo.findSession(session.idHash)).toMatchObject({ lastSeenAt: later })
      await repo.revokeSession(session.idHash, later)
      expect(await repo.findSession(session.idHash)).toMatchObject({ revokedAt: later })
      expect(await repo.findSession(crypto.randomUUID())).toBeNull()
    })

    it('US-56.4 finds an invitation only while it is unused and unexpired, and uses it once', async () => {
      const repo = await make()
      const invite = {
        id: crypto.randomUUID(),
        emailHmac: 'hmac',
        tokenHash: crypto.randomUUID(),
        invitedBy: null,
        expiresAt: new Date('2026-12-06T12:00:00Z'),
      }
      await repo.createInvite(invite)
      const before = new Date('2026-12-06T11:59:59Z')
      expect(await repo.findUsableInvite(invite.tokenHash, before)).toBe(invite.id)
      expect(await repo.findUsableInvite(invite.tokenHash, invite.expiresAt)).toBeNull()
      expect(await repo.findUsableInvite(crypto.randomUUID(), before)).toBeNull()
      expect(await repo.useInvite(invite.id, before)).toBe(true)
      expect(await repo.useInvite(invite.id, before)).toBe(false)
      expect(await repo.findUsableInvite(invite.tokenHash, before)).toBeNull()
    })

    it('US-56.4 accepts an email already on the waiting list in another case', async () => {
      const repo = await make()
      const email = `Ash.${crypto.randomUUID().slice(0, 8)}@Example.com`
      await repo.joinWaitlist({ id: crypto.randomUUID(), email, locale: 'fr' })
      await repo.joinWaitlist({ id: crypto.randomUUID(), email: email.toLowerCase(), locale: 'en' })
    })
  })
}
