import type { EmailMessage, Mailer } from '../../server/modules/identity'

/** Mailer fake (11-strategie-de-tests.md § 3): `sent` lists the delivered messages. */
export function recordingMailer({ refusing = false } = {}) {
  const sent: EmailMessage[] = []
  const mailer: Mailer = {
    async send(message) {
      if (refusing) throw new Error('mail provider refused the message')
      sent.push(structuredClone(message))
    },
  }
  return { mailer, sent }
}
