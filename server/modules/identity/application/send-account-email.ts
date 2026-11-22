import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import { hashToken, newToken, RESET_TTL_MS, VERIFY_TTL_MS } from './email-tokens'
import type { IdentityRepository, Locale, Mailer } from './ports'

export type AccountEmail = {
  template: 'verify' | 'reset' | 'password_changed' | 'account_exists' | 'signin_locked'
  userId: string
}

// Templates that carry a single-use link: token type, validity and page that reads it from the fragment
const LINKS = {
  verify: { type: 'verify', ttlMs: VERIFY_TTL_MS, page: '/verify-email' },
  reset: { type: 'reset', ttlMs: RESET_TTL_MS, page: '/reset' },
} as const

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
    reset: {
      subject: 'Reset your password',
      text: (name, link) =>
        `Hello ${name},\n\nChoose a new password for your Legendary Shots account:\n${link}\n\n` +
        `This link is valid for 1 hour and signs you out everywhere. If you did not ask for it, ignore this email: ` +
        `your password stays the same.`,
    },
    account_exists: {
      subject: 'You already have an account',
      text: (name, link) =>
        `Hello ${name},\n\nSomeone tried to create a Legendary Shots account with this email address, ` +
        `but you already have one. Sign in here, or reset your password from that page:\n${link}\n\n` +
        `If it was not you, you can ignore this email.`,
    },
    password_changed: {
      subject: 'Your password was changed',
      text: (name, link) =>
        `Hello ${name},\n\nThe password of your Legendary Shots account was just changed with a reset link, ` +
        `and every device was signed out.\n\nIf it was you, there is nothing to do. If it was not, someone can ` +
        `read your emails: secure your mailbox, then reset your password again:\n${link}`,
    },
    signin_locked: {
      subject: 'Sign-in to your account is paused',
      text: (name, link) =>
        `Hello ${name},\n\nThere were 20 failed sign-in attempts on your Legendary Shots account within an hour, ` +
        `so signing in with your password is paused for up to an hour.\n\nIf it was you, wait a little and try ` +
        `again. If it was not, your password is still safe; you can change it from the sign-in page:\n${link}`,
    },
  },
  fr: {
    verify: {
      subject: 'Vérifiez votre adresse email',
      text: (name, link) =>
        `Bonjour ${name},\n\nConfirmez votre adresse email pour publier vos captures sur Legendary Shots :\n` +
        `${link}\n\nCe lien est valable 24 heures. Si vous n'avez pas créé ce compte, ignorez cet email.`,
    },
    reset: {
      subject: 'Réinitialisez votre mot de passe',
      text: (name, link) =>
        `Bonjour ${name},\n\nChoisissez un nouveau mot de passe pour votre compte Legendary Shots :\n${link}\n\n` +
        `Ce lien est valable 1 heure et vous déconnecte partout. Si vous ne l'avez pas demandé, ignorez cet email : ` +
        `votre mot de passe reste inchangé.`,
    },
    account_exists: {
      subject: 'Vous avez déjà un compte',
      text: (name, link) =>
        `Bonjour ${name},\n\nQuelqu'un a essayé de créer un compte Legendary Shots avec cette adresse, ` +
        `mais vous en avez déjà un. Connectez-vous ici, ou réinitialisez votre mot de passe depuis cette page :\n` +
        `${link}\n\nSi ce n'était pas vous, ignorez cet email.`,
    },
    password_changed: {
      subject: 'Votre mot de passe a été modifié',
      text: (name, link) =>
        `Bonjour ${name},\n\nLe mot de passe de votre compte Legendary Shots vient d'être modifié avec un lien de ` +
        `réinitialisation, et tous vos appareils ont été déconnectés.\n\nSi c'était vous, il n'y a rien à faire. ` +
        `Sinon, quelqu'un peut lire vos emails : sécurisez votre boîte mail, puis réinitialisez de nouveau votre ` +
        `mot de passe :\n${link}`,
    },
    signin_locked: {
      subject: 'La connexion à votre compte est suspendue',
      text: (name, link) =>
        `Bonjour ${name},\n\n20 tentatives de connexion ont échoué sur votre compte Legendary Shots en une heure : ` +
        `la connexion par mot de passe est suspendue pendant une heure au plus.\n\nSi c'était vous, patientez un ` +
        `peu avant de réessayer. Sinon, votre mot de passe reste protégé ; vous pouvez le changer depuis la page ` +
        `de connexion :\n${link}`,
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
    let link = `${base}${template === 'password_changed' ? '/reset' : '/signin'}`
    if (template === 'verify' || template === 'reset') {
      const { type, ttlMs, page } = LINKS[template]
      const token = newToken()
      await deps.repo.createEmailToken({
        id: deps.ids.next(),
        userId,
        type,
        tokenHash: await hashToken(token),
        expiresAt: new Date(deps.clock.now().getTime() + ttlMs),
      })
      link = `${base}${page}#${token}` // fragment: the token never reaches a server log
    }
    const texts = TEMPLATES[recipient.locale][template]
    await deps.mailer.send({ to: recipient.email, subject: texts.subject, text: texts.text(recipient.username, link) })
  }
