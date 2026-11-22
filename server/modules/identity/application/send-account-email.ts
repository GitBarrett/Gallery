import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import { hashToken, newToken, VERIFY_TTL_MS } from './email-tokens'
import type { IdentityRepository, Locale, Mailer } from './ports'

export type AccountEmail = { template: 'verify' | 'account_exists'; userId: string }

type Texts = { subject: string; text: (username: string, link: string) => string }

// Bilingual templates (03-architecture.md § Emails transactionnels): plain text, no user HTML
const TEMPLATES: Record<Locale, Record<AccountEmail['template'], Texts>> = {
  en: {
    verify: {
      subject: 'Verify your email',
      text: (name, link) =>
        `Hello ${name},\n\nConfirm your email address to publish your captures on Legendary Shots:\n${link}\n\n` +
        `This link is valid for 24 hours. If you did not create this account, ignore this email.`,
    },
    account_exists: {
      subject: 'You already have an account',
      text: (name, link) =>
        `Hello ${name},\n\nSomeone tried to create a Legendary Shots account with this email address, ` +
        `but you already have one. Sign in here, or reset your password from that page:\n${link}\n\n` +
        `If it was not you, you can ignore this email.`,
    },
  },
  fr: {
    verify: {
      subject: 'Vérifiez votre adresse email',
      text: (name, link) =>
        `Bonjour ${name},\n\nConfirmez votre adresse email pour publier vos captures sur Legendary Shots :\n` +
        `${link}\n\nCe lien est valable 24 heures. Si vous n'avez pas créé ce compte, ignorez cet email.`,
    },
    account_exists: {
      subject: 'Vous avez déjà un compte',
      text: (name, link) =>
        `Bonjour ${name},\n\nQuelqu'un a essayé de créer un compte Legendary Shots avec cette adresse, ` +
        `mais vous en avez déjà un. Connectez-vous ici, ou réinitialisez votre mot de passe depuis cette page :\n` +
        `${link}\n\nSi ce n'était pas vous, ignorez cet email.`,
    },
  },
}

/**
 * Consumer of the identity emails (queue `emails`). The token is created here, at sending time, so that it
 * never sits in clear in the outbox. Run once per event by the idempotency guard, in its transaction.
 */
export const sendAccountEmail =
  (deps: { repo: IdentityRepository; mailer: Mailer; clock: Clock; ids: IdGenerator; siteUrl: string }) =>
  async ({ template, userId }: AccountEmail): Promise<void> => {
    const recipient = await deps.repo.findRecipient(userId)
    if (!recipient) return // account deleted in the meantime
    const base = `${deps.siteUrl}${recipient.locale === 'fr' ? '/fr' : ''}`
    let link = `${base}/signin`
    if (template === 'verify') {
      const token = newToken()
      await deps.repo.createEmailToken({
        id: deps.ids.next(),
        userId,
        type: 'verify',
        tokenHash: await hashToken(token),
        expiresAt: new Date(deps.clock.now().getTime() + VERIFY_TTL_MS),
      })
      link = `${base}/verify-email#${token}` // fragment: the token never reaches a server log
    }
    const texts = TEMPLATES[recipient.locale][template]
    await deps.mailer.send({ to: recipient.email, subject: texts.subject, text: texts.text(recipient.username, link) })
  }
