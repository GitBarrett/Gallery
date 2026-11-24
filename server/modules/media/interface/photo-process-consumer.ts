import { z } from 'zod'
import type { MessageHandler } from '../../../platform/jobs'
import { eventEnvelope } from '../../../platform/unit-of-work'
import { failCapture, processCapture } from '../application/process-capture'
import type { ImageService, MediaRepository, ObjectStorage } from '../application/ports'

// shortcut: captures only; the avatars (`avatar-process`, same queue) arrive with their task
const PhotoProcess = z.strictObject({ kind: z.literal('capture'), photoId: z.uuid() })

/** First delivery and the 3 retries of wrangler.toml (`max_retries`): the last one marks the capture failed (US-10.8). */
export const PROCESS_ATTEMPTS = 4

/**
 * Consumer of the `photo-process` queue. Idempotent by the status (only a `processing` capture is handled) rather
 * than `processed_messages`: the work is in R2 and the binding, out of any transaction. A failure goes back to the
 * queue; the last attempt first ends the capture `failed`, then the message reaches the DLQ (alert).
 */
export const photoProcessConsumer =
  (deps: { repo: MediaRepository; storage: ObjectStorage; images: ImageService }): MessageHandler =>
  async (body, message) => {
    const { photoId } = PhotoProcess.parse(eventEnvelope.parse(body).payload)
    try {
      await processCapture(deps)(photoId)
    } catch (error) {
      if (message.attempts >= PROCESS_ATTEMPTS) await failCapture(deps)(photoId)
      throw error
    }
  }
