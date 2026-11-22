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
