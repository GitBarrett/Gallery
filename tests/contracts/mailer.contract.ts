import { describe, expect, it } from 'vitest'
import type { EmailMessage, Mailer } from '../../server/modules/identity'

// Contract of the Mailer port (11-strategie-de-tests.md § 4): checked on the fake and on the Resend adapter.
// `make` returns the mailer and what the provider received; `refusing` makes the provider refuse every message.
export function mailerContract(
  name: string,
  make: (options: { refusing: boolean }) => { mailer: Mailer; delivered: () => EmailMessage[] },
) {
  describe(`Mailer contract: ${name}`, () => {
    const message = { to: 'ash@example.com', subject: 'Verify your email', text: 'https://example.com/verify#token' }

    it('delivers the message as given', async () => {
      const { mailer, delivered } = make({ refusing: false })
      await mailer.send(message)
      expect(delivered()).toEqual([message])
    })

    it('rejects when the provider refuses, without the recipient in the error', async () => {
      const { mailer, delivered } = make({ refusing: true })
      const error = await mailer.send(message).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(Error)
      expect(String((error as Error).message)).not.toContain(message.to)
      expect(delivered()).toEqual([])
    })
  })
}
