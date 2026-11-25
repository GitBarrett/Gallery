import { z } from 'zod'
import type { MessageHandler } from '../../../platform/jobs'
import { eventEnvelope } from '../../../platform/unit-of-work'
import { failAvatar, processAvatar } from '../application/avatars'
import { failCapture, processCapture } from '../application/process-capture'

// A capture (T-22b) or an avatar version (US-07.6), on the same queue (03 § Pipeline image)
const PhotoProcess = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('capture'), photoId: z.uuid() }),
  z.strictObject({ kind: z.literal('avatar'), userId: z.uuid(), version: z.uuid() }),
])

/** First delivery and the 3 retries of wrangler.toml (`max_retries`): the last one marks the work failed (US-10.8). */
export const PROCESS_ATTEMPTS = 4

/**
 * Consumer of the `photo-process` queue. Idempotent by the status (only a `processing` capture or a pending avatar
 * is handled) rather than `processed_messages`: the work is in R2 and the binding, out of any transaction. A failure
 * goes back to the queue; the last attempt first ends the capture `failed` (or forgets the avatar), then the message
 * reaches the DLQ (alert).
 */
export const photoProcessConsumer =
  (deps: Parameters<typeof processCapture>[0] & { avatars?: Parameters<typeof processAvatar>[0] }): MessageHandler =>
  async (body, message) => {
    const work = PhotoProcess.parse(eventEnvelope.parse(body).payload)
    try {
      if (work.kind === 'capture') await processCapture(deps)(work.photoId)
      else await processAvatar(avatarsOf(deps))(work)
    } catch (error) {
      if (message.attempts >= PROCESS_ATTEMPTS)
        await (work.kind === 'capture' ? failCapture(deps)(work.photoId) : failAvatar(avatarsOf(deps))(work))
      throw error
    }
  }

const avatarsOf = (deps: { avatars?: Parameters<typeof processAvatar>[0] }) => {
  if (!deps.avatars) throw new Error('avatar processing is not wired')
  return deps.avatars
}
