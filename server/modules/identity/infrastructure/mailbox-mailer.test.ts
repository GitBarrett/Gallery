import { mailerContract } from '../../../../tests/contracts/mailer.contract'
import type { EmailMessage } from '../application/ports'
import { mailboxKey, mailboxMailer } from './mailbox-mailer'

// R2 replaced by a map; a refusing bucket fails every write
mailerContract('preview mailbox', ({ refusing }) => {
  const objects = new Map<string, string>()
  const bucket = {
    async put(key: string, value: string) {
      if (refusing) throw new Error(`R2 refused ${key}`)
      objects.set(key, value)
    },
  }
  const delivered = (): EmailMessage[] => {
    const stored = objects.get(mailboxKey('pr-7/', 'ash@example.com'))
    return stored ? [JSON.parse(stored)] : []
  }
  return { mailer: mailboxMailer({ bucket, prefix: 'pr-7/' }), delivered }
})
