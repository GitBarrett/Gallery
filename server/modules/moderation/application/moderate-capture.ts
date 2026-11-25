import type { Logger } from '../../../platform/logger'
import { decide, type ModerationOutcome, type ModerationThresholds } from '../domain/decision'
import type { ModerationDecisionsRepository, ModerationProvider, ModerationScores } from './ports'

/** Calls of the provider before a moderator takes over (US-50.4), with an exponential backoff between them. */
export const PROVIDER_ATTEMPTS = 3
const BACKOFF_MS = 1000

/**
 * Automatic moderation of a processed capture (US-50, 03 § Pipeline image 5): its 1200 px JPEG goes to the provider,
 * the max score is compared with the thresholds of the moment (US-50.5) and the decision is recorded with the raw
 * scores (US-50.6). A provider that fails 3 times sends the capture to review (US-50.4), never to `failed`.
 */
export const moderateCapture =
  (deps: {
    provider: ModerationProvider
    decisions: ModerationDecisionsRepository
    thresholds: () => Promise<ModerationThresholds>
    sleep: (ms: number) => Promise<void>
    logger: Logger
  }) =>
  async (capture: {
    photoId: string
    title: string | null
    image: Uint8Array
    /** An avatar version as `photoId` (US-07.6). */
    target?: 'photo' | 'avatar'
  }): Promise<{ outcome: ModerationOutcome; score: number | null }> => {
    const found = await scoresOf(deps, capture)
    const outcome = decide(found?.score ?? null, await deps.thresholds())
    await deps.decisions.recordAuto({
      ...(capture.target && { targetType: capture.target }),
      targetId: capture.photoId,
      decision: outcome,
      scores: found?.raw ?? null,
      reason: found ? null : 'provider_unavailable',
    })
    return { outcome, score: found?.score ?? null }
  }

async function scoresOf(
  deps: { provider: ModerationProvider; sleep: (ms: number) => Promise<void>; logger: Logger },
  capture: { title: string | null; image: Uint8Array },
): Promise<ModerationScores | null> {
  for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS; attempt++) {
    try {
      return await deps.provider.check(capture.image, { title: capture.title })
    } catch (error) {
      deps.logger.warn('moderation provider failed', { attempt, error: String(error) })
      if (attempt < PROVIDER_ATTEMPTS) await deps.sleep(BACKOFF_MS * 2 ** (attempt - 1))
    }
  }
  return null
}
