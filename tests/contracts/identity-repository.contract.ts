import { describe, expect, it } from 'vitest'
import type { IdentityRepository, NewUser } from '../../server/modules/identity'

// Contract of the IdentityRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `make` returns an empty repository (or one where the run's unique values are unused).
export function identityRepositoryContract(name: string, make: () => Promise<IdentityRepository>) {
  const user = (): NewUser & { email: string; passwordHash: string } => {
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
      expect(await repo.findRecipient(ash.id)).toEqual({
        email: ash.email,
        username: ash.username,
        locale: 'fr',
        notificationPrefs: { likes: true, comments: true, followers: true, contests: true },
      })
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
      expect(await repo.findEmailToken(t.tokenHash, 'verify')).toEqual({ ...t, newEmail: null, usedAt: null })
      const now = new Date('2026-11-22T13:00:00Z')
      expect(await repo.useEmailToken(t.id, now)).toBe(true)
      expect(await repo.useEmailToken(t.id, now)).toBe(false)
      expect((await repo.findEmailToken(t.tokenHash, 'verify'))?.usedAt).toEqual(now)
      await repo.markEmailVerified(ash.id, now)
    })

    it('US-07.2 keeps the address of an email change token, then sets the new email verified', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const t = { ...token(ash.id), type: 'email_change' as const, newEmail: `new.${ash.email}` }
      await repo.createEmailToken(t)
      expect((await repo.findEmailToken(t.tokenHash, 'email_change'))?.newEmail).toBe(t.newEmail)
      const at = new Date('2026-11-23T12:00:00Z')
      await repo.setEmail(ash.id, t.newEmail, at)
      expect(await repo.findUserIdByEmail(t.newEmail)).toBe(ash.id)
      expect(await repo.findUserIdByEmail(ash.email)).toBeNull()
    })

    it('returns the recipient of an account without email, its email null (Q55)', async () => {
      const repo = await make()
      const ash = { ...user(), email: null, passwordHash: null }
      await repo.createUser(ash)
      expect(await repo.findRecipient(ash.id)).toMatchObject({ email: null, username: ash.username, locale: 'fr' })
    })

    it('US-35.3 gives the usernames of the existing accounts among ids, for the notifications', async () => {
      const repo = await make()
      const [ash, jaina] = [user(), user()]
      await repo.createUser(ash)
      await repo.createUser(jaina)
      const missing = crypto.randomUUID()
      expect(await repo.usernames([ash.id, jaina.id, missing])).toEqual(
        new Map([
          [ash.id, ash.username],
          [jaina.id, jaina.username],
        ]),
      )
      expect(await repo.usernames([])).toEqual(new Map())
    })

    it('US-07.6 keeps the avatar shown until the pending one is promoted, and forgets a dropped one', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const [first, second, third] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
      expect(await repo.findAvatar(ash.id)).toEqual({ current: null, pending: null })
      await repo.setPendingAvatar(ash.id, first)
      expect(await repo.promoteAvatar(ash.id, second)).toBe(false) // not the pending one
      expect(await repo.promoteAvatar(ash.id, first)).toEqual({ previous: null })
      await repo.setPendingAvatar(ash.id, second)
      expect(await repo.findAvatar(ash.id)).toEqual({ current: first, pending: second })
      expect(await repo.promoteAvatar(ash.id, second)).toEqual({ previous: first })
      await repo.setPendingAvatar(ash.id, third)
      expect(await repo.dropPendingAvatar(ash.id, third)).toBe(true)
      expect(await repo.dropPendingAvatar(ash.id, third)).toBe(false)
      expect(await repo.findAvatar(ash.id)).toEqual({ current: second, pending: null })
      expect(await repo.findProfile(ash.username)).toMatchObject({ id: ash.id, avatar: second }) // US-05.3
      expect(await repo.findAvatar(crypto.randomUUID())).toBeNull()
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

    it('US-02.1 creates an OAuth account without password, its email verified, and finds it by its subject', async () => {
      const repo = await make()
      const ash = { ...user(), passwordHash: null, emailVerifiedAt: new Date('2026-11-22T12:00:00Z') }
      expect(await repo.createUser(ash)).toBe('created')
      const subject = `google-${ash.id}`
      const link = { id: crypto.randomUUID(), userId: ash.id, provider: 'google' as const, subject }
      expect(await repo.linkOAuthAccount(link)).toBe(true)
      expect(await repo.linkOAuthAccount({ ...link, id: crypto.randomUUID() })).toBe(false) // already linked
      expect(await repo.findOAuthAccount('google', subject)).toEqual({ userId: ash.id, status: 'active' })
      expect(await repo.findOAuthAccount('google', `${subject}x`)).toBeNull()
      expect(await repo.findCredentials(ash.email)).toMatchObject({ passwordHash: null })
    })

    it('US-07.4 lists the providers of an account and unlinks one, only its own', async () => {
      const repo = await make()
      const [ash, thrall] = [user(), user()]
      await repo.createUser(ash)
      await repo.createUser(thrall)
      const link = (userId: string, provider: 'google' | 'battlenet') =>
        repo.linkOAuthAccount({ id: crypto.randomUUID(), userId, provider, subject: `${provider}-${userId}` })
      await link(ash.id, 'battlenet')
      await link(ash.id, 'google')
      await link(thrall.id, 'google')
      expect(await repo.listOAuthProviders(ash.id)).toEqual(['google', 'battlenet'])
      expect(await repo.unlinkOAuthAccount(ash.id, 'google')).toBe(true)
      expect(await repo.unlinkOAuthAccount(ash.id, 'google')).toBe(false)
      expect(await repo.listOAuthProviders(ash.id)).toEqual(['battlenet'])
      expect(await repo.listOAuthProviders(thrall.id)).toEqual(['google'])
    })

    it('US-02.1 creates accounts without email, any number of them', async () => {
      const repo = await make()
      expect(await repo.createUser({ ...user(), email: null })).toBe('created')
      expect(await repo.createUser({ ...user(), email: null })).toBe('created')
    })

    it('US-05.3 finds the public profile of a username in any case, with its display case', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const profile = await repo.findProfile(ash.username.toUpperCase())
      expect(profile).toMatchObject({ username: ash.username, bio: null, status: 'active', socialLinks: [] })
      expect(profile?.createdAt).toBeInstanceOf(Date)
      expect(await repo.findProfile(`${ash.username}x`)).toBeNull()
    })

    it('US-07.1 updates the bio and the language of an account, each one alone', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      await repo.updateProfile(ash.id, { bio: 'Moonwell watcher.' })
      expect(await repo.findProfile(ash.username)).toMatchObject({ bio: 'Moonwell watcher.' })
      expect((await repo.findRecipient(ash.id))?.locale).toBe('fr')
      await repo.updateProfile(ash.id, { locale: 'en' })
      expect((await repo.findRecipient(ash.id))?.locale).toBe('en')
      await repo.updateProfile(ash.id, { bio: null })
      expect(await repo.findProfile(ash.username)).toMatchObject({ bio: null })
    })

    it('US-07.5 merges the notification preferences of an account into the stored ones', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      await repo.updateProfile(ash.id, { notificationPrefs: { likes: false } })
      await repo.updateProfile(ash.id, { notificationPrefs: { followers: false } })
      await repo.updateProfile(ash.id, { bio: 'Unchanged preferences.' })
      expect((await repo.findRecipient(ash.id))?.notificationPrefs).toEqual({
        likes: false,
        comments: true,
        followers: false,
        contests: true,
      })
    })

    it('US-82.4 stores the social links of an account, replaced as a whole, read in network order', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      await repo.setSocialLinks(ash.id, [
        { platform: 'website', handle: 'https://ash.example.com' },
        { platform: 'twitch', handle: 'Ash_Barrett' },
      ])
      expect((await repo.findProfile(ash.username))?.socialLinks).toEqual([
        { platform: 'twitch', handle: 'Ash_Barrett' },
        { platform: 'website', handle: 'https://ash.example.com' },
      ])
      await repo.setSocialLinks(ash.id, [{ platform: 'discord', handle: 'ash.barrett' }])
      expect((await repo.findProfile(ash.username))?.socialLinks).toEqual([
        { platform: 'discord', handle: 'ash.barrett' },
      ])
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
      const account = {
        id: ash.id,
        username: ash.username,
        role: 'user',
        status: 'active',
        emailVerified: false,
        avatar: null,
      }
      expect(await repo.findSession(session.idHash)).toEqual({
        createdAt: expect.any(Date),
        lastSeenAt: at,
        expiresAt: session.expiresAt,
        revokedAt: null,
        mfaVerifiedAt: null,
        account,
      })
      const verified = { ...session, idHash: crypto.randomUUID(), mfaVerifiedAt: at }
      await repo.createSession(verified)
      expect(await repo.findSession(verified.idHash)).toMatchObject({ mfaVerifiedAt: at })
      const later = new Date('2026-11-23T12:00:00Z')
      await repo.touchSession(session.idHash, later, new Date('2026-12-23T12:00:00Z'))
      expect(await repo.findSession(session.idHash)).toMatchObject({ lastSeenAt: later })
      await repo.revokeSession(session.idHash, later)
      expect(await repo.findSession(session.idHash)).toMatchObject({ revokedAt: later })
      expect(await repo.findSession(crypto.randomUUID())).toBeNull()
    })

    it('US-55.2 keeps a pending TOTP secret, enables it with its recovery codes, each step and code once', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const at = new Date('2026-11-24T12:00:00Z')
      expect(await repo.findMfa(ash.id)).toEqual({ secretEnc: null, enabledAt: null, lastStep: null })
      await repo.setPendingMfa(ash.id, 'sealed-1')
      await repo.setPendingMfa(ash.id, 'sealed-2')
      expect(await repo.findMfa(ash.id)).toEqual({ secretEnc: 'sealed-2', enabledAt: null, lastStep: null })
      await repo.enableMfa(ash.id, { at, step: 100, codeHashes: ['h1', 'h2'] })
      await repo.setPendingMfa(ash.id, 'sealed-3')
      expect(await repo.findMfa(ash.id)).toEqual({ secretEnc: 'sealed-2', enabledAt: at, lastStep: 100 })
      expect(await repo.useTotpStep(ash.id, 100)).toBe(false)
      expect(await repo.useTotpStep(ash.id, 101)).toBe(true)
      expect(await repo.findMfa(ash.id)).toMatchObject({ lastStep: 101 })
      expect(await repo.useRecoveryCode(ash.id, 'h1', at)).toBe(true)
      expect(await repo.useRecoveryCode(ash.id, 'h1', at)).toBe(false)
      expect(await repo.useRecoveryCode(ash.id, 'unknown', at)).toBe(false)
      const other = user()
      await repo.createUser(other)
      expect(await repo.useRecoveryCode(other.id, 'h2', at)).toBe(false)
      await repo.enableMfa(ash.id, { at, step: 200, codeHashes: ['h3'] })
      expect(await repo.useRecoveryCode(ash.id, 'h2', at)).toBe(false)
      expect(await repo.useRecoveryCode(ash.id, 'h3', at)).toBe(true)
      expect(await repo.findMfa(crypto.randomUUID())).toBeNull()
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

    it('US-05.4 renames and keeps the former name to its owner until the redirect ends', async () => {
      const repo = await make()
      const ash = user()
      await repo.createUser(ash)
      const at = new Date('2026-11-23T12:00:00Z')
      const until = new Date('2027-02-21T12:00:00Z')
      const renamed = `${ash.username}_New`
      expect(await repo.findUsername(ash.id)).toEqual({ username: ash.username, changedAt: null })
      await repo.renameUser({ userId: ash.id, previous: ash.username, username: renamed, at, redirectUntil: until })
      expect(await repo.findUsername(ash.id)).toEqual({ username: renamed, changedAt: at })
      expect(await repo.usernameOwner(renamed.toUpperCase(), at)).toBe(ash.id)
      expect(await repo.usernameOwner(ash.username.toUpperCase(), at)).toBe(ash.id)
      expect(await repo.usernameOwner(ash.username, until)).toBeNull()
      // taking it back: no redirect left on the current name
      await repo.renameUser({ userId: ash.id, previous: renamed, username: ash.username, at, redirectUntil: until })
      expect(await repo.findProfile(ash.username)).toMatchObject({ username: ash.username })
      expect(await repo.usernameOwner(renamed, at)).toBe(ash.id)
      expect(await repo.usernameOwner(`${ash.username}_none`, at)).toBeNull()
    })
  })
}
