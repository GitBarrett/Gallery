import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { recordingMailer } from '../../../../tests/fakes/recording-mailer'
import { hashToken } from './email-tokens'
import { sendAccountEmail } from './send-account-email'

const clock = fixedClock('2026-11-22T12:00:00Z')

async function setup(locale: 'en' | 'fr' = 'en') {
  const fake = inMemoryIdentityRepository()
  await fake.repo.createUser({
    id: 'ash',
    email: 'ash@example.com',
    username: 'Ash_Barrett',
    passwordHash: 'h',
    locale,
    termsAcceptedAt: clock.now(),
    termsVersion: 'v',
  })
  const { mailer, sent } = recordingMailer()
  const send = sendAccountEmail({
    repo: fake.repo,
    mailer,
    clock,
    ids: { next: () => 'token-1' },
    siteUrl: 'https://legendaryshots.gg',
  })
  return { send, sent, tokens: fake.tokens }
}

describe('sendAccountEmail', () => {
  it('US-01.1 sends a verification link valid 24 h, whose token is only stored hashed', async () => {
    const { send, sent, tokens } = await setup()
    await send({ template: 'verify', userId: 'ash' })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'ash@example.com', subject: 'Verify your email' })
    const token = sent[0]!.text.match(/https:\/\/legendaryshots\.gg\/verify-email#([\w-]{43})/)![1]!
    expect(sent[0]!.text).toContain('Ash_Barrett')
    expect(tokens).toEqual([
      {
        id: 'token-1',
        userId: 'ash',
        type: 'verify',
        tokenHash: await hashToken(token),
        expiresAt: new Date('2026-11-23T12:00:00Z'),
        newEmail: null,
        usedAt: null,
      },
    ])
  })

  it('US-04.1 sends a reset link valid 1 h, whose token is only stored hashed', async () => {
    const { send, sent, tokens } = await setup('fr')
    await send({ template: 'reset', userId: 'ash' })
    expect(sent[0]).toMatchObject({ to: 'ash@example.com', subject: 'Réinitialisez votre mot de passe' })
    const token = sent[0]!.text.match(/https:\/\/legendaryshots\.gg\/fr\/reset#([\w-]{43})/)![1]!
    expect(tokens).toEqual([
      expect.objectContaining({
        type: 'reset',
        tokenHash: await hashToken(token),
        expiresAt: new Date('2026-11-22T13:00:00Z'),
      }),
    ])
  })

  it('US-04.6 tells the owner that the password changed, with a link to start again', async () => {
    const { send, sent, tokens } = await setup()
    await send({ template: 'password_changed', userId: 'ash' })
    expect(sent[0]).toMatchObject({ to: 'ash@example.com', subject: 'Your password was changed' })
    expect(sent[0]!.text).toContain('https://legendaryshots.gg/reset')
    expect(tokens).toEqual([])
  })

  it('US-01.2 tells the owner of a used email that an account already exists', async () => {
    const { send, sent, tokens } = await setup()
    await send({ template: 'account_exists', userId: 'ash' })
    expect(sent[0]).toMatchObject({ to: 'ash@example.com', subject: 'You already have an account' })
    expect(sent[0]!.text).toContain('https://legendaryshots.gg/signin')
    expect(tokens).toEqual([])
  })

  it('writes in the language of the account, with the French URLs', async () => {
    const { send, sent } = await setup('fr')
    await send({ template: 'verify', userId: 'ash' })
    expect(sent[0]!.subject).toBe('Vérifiez votre adresse email')
    expect(sent[0]!.text).toContain('https://legendaryshots.gg/fr/verify-email#')
  })

  it('sends nothing for an account deleted in the meantime', async () => {
    const { send, sent } = await setup()
    await send({ template: 'verify', userId: 'gone' })
    expect(sent).toEqual([])
  })

  it('US-07.2 mails the change link to the new address, the token holding it, and the alert to the old one', async () => {
    const { send, sent, tokens } = await setup('fr')
    await send({ template: 'email_change', userId: 'ash', newEmail: 'ash.new@example.com' })
    await send({ template: 'email_change_alert', userId: 'ash' })
    expect(sent.map((m) => [m.to, m.subject])).toEqual([
      ['ash.new@example.com', 'Confirmez votre nouvelle adresse email'],
      ['ash@example.com', "Un changement d'email a été demandé"],
    ])
    const token = sent[0]!.text.match(/https:\/\/legendaryshots\.gg\/fr\/confirm-email#([\w-]{43})/)![1]!
    expect(tokens[0]).toMatchObject({
      type: 'email_change',
      tokenHash: await hashToken(token),
      newEmail: 'ash.new@example.com',
      expiresAt: new Date('2026-11-23T12:00:00Z'),
    })
  })
})
