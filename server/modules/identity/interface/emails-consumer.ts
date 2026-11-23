import { z } from 'zod'
import type { Db } from '../../../db/client'
import { onceOnly } from '../../../db/idempotency'
import type { Clock } from '../../../platform/clock'
import type { IdGenerator } from '../../../platform/ids'
import type { MessageHandler } from '../../../platform/jobs'
import { eventEnvelope } from '../../../platform/unit-of-work'
import type { Mailer } from '../application/ports'
import { sendAccountEmail } from '../application/send-account-email'
import { drizzleIdentityRepository } from '../infrastructure/drizzle-identity-repository'

const AccountEmail = z.strictObject({
  template: z.enum([
    'verify',
    'reset',
    'password_changed',
    'account_exists',
    'signin_locked',
    'email_change',
    'email_change_alert',
  ]),
  userId: z.uuid(),
  newEmail: z.email().max(254).optional(),
})

/** Consumer of the `emails` queue: one email per event, even when Queues delivers it twice. */
export const emailsConsumer =
  (deps: { db: Db; mailer: Mailer; clock: Clock; ids: IdGenerator; siteUrl: string }): MessageHandler =>
  async (body) => {
    const { eventId, payload } = eventEnvelope.parse(body)
    const email = AccountEmail.parse(payload)
    await onceOnly(deps.db, 'identity.emails', eventId, (tx) =>
      sendAccountEmail({ ...deps, repo: drizzleIdentityRepository(tx) })(email),
    )
  }
