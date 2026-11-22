import type { EmailMessage, Mailer } from '../application/ports'

export interface MailboxBucket {
  put(key: string, value: string): Promise<unknown>
}

/** R2 key of the last email sent to `to` in a preview's mailbox (read by /__test/mailbox). */
export const mailboxKey = (prefix: string, to: string) => `${prefix}mailbox/${to.toLowerCase()}`

/**
 * Fake provider of the previews (fake providers on, R2 bound): nothing is sent, the last email of each address is
 * kept under the preview's R2 prefix, so that the E2E opens its link (11-strategie-de-tests.md § 3, ADR-013).
 */
export const mailboxMailer = ({ bucket, prefix }: { bucket: MailboxBucket; prefix: string }): Mailer => ({
  async send(message: EmailMessage) {
    try {
      await bucket.put(mailboxKey(prefix, message.to), JSON.stringify(message))
    } catch {
      throw new Error('mailbox write failed') // the key holds the address: not in the error
    }
  },
})
