import { z } from 'zod'
import { QUALITIES } from '../../../../shared/domain/quality'
import type { Db } from '../../../db/client'
import { onceOnly } from '../../../db/idempotency'
import type { Clock } from '../../../platform/clock'
import type { MessageHandler } from '../../../platform/jobs'
import { eventEnvelope } from '../../../platform/unit-of-work'
import { drizzleIdentityRepository } from '../../identity'
import { notify, type NotificationEvent } from '../application/notify'
import { drizzleNotificationsRepository } from '../infrastructure/drizzle-notifications-repository'

const recipient = { userId: z.uuid() }
const Event = z.discriminatedUnion('type', [
  z.strictObject({ ...recipient, type: z.literal('like'), photoId: z.uuid(), actorId: z.uuid() }),
  z.strictObject({
    ...recipient,
    type: z.literal('comment'),
    photoId: z.uuid(),
    commentId: z.uuid(),
    actorId: z.uuid(),
  }),
  z.strictObject({ ...recipient, type: z.literal('follow'), actorId: z.uuid() }),
  z.strictObject({
    ...recipient,
    type: z.literal('moderation'),
    photoId: z.uuid().optional(), // absent: the avatar (US-07.6)
    outcome: z.enum(['published', 'pending_review', 'rejected', 'failed']),
  }),
  z.strictObject({ ...recipient, type: z.literal('quality'), photoId: z.uuid(), quality: z.enum(QUALITIES) }),
  z.strictObject({
    ...recipient,
    type: z.literal('contest'),
    contestId: z.uuid(),
    event: z.enum(['opened', 'ending', 'extended', 'disqualified', 'results']),
    reason: z.string().max(500).optional(),
  }),
]) satisfies z.ZodType<NotificationEvent>

/** Consumer of the `notifications` queue: one notification per event, even when Queues delivers it twice. */
export const notificationsConsumer =
  (deps: { db: Db; clock: Clock }): MessageHandler =>
  async (body) => {
    const { eventId, payload } = eventEnvelope.parse(body)
    const event = Event.parse(payload)
    await onceOnly(deps.db, 'notifications.create', eventId, async (tx) => {
      const identity = drizzleIdentityRepository(tx)
      await notify({
        repo: drizzleNotificationsRepository(tx),
        prefsOf: async (userId) => (await identity.findRecipient(userId))?.notificationPrefs ?? null,
        clock: deps.clock,
      })(event)
    })
  }
