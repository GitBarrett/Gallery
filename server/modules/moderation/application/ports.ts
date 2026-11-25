import type { ModerationOutcome } from '../domain/decision'

/** What the provider found in an image: its max score over the checked models and its raw answer (US-50.6). */
export interface ModerationScores {
  score: number
  raw: Record<string, unknown>
}

/**
 * Port: the image moderation provider (Sightengine, ADR-005). `title` is only read by the fake, which scores a
 * capture by its title (11-strategie-de-tests.md § Fakes: fixtures named `*_nsfw`). Throws when it does not answer.
 */
export interface ModerationProvider {
  check(image: Uint8Array, context: { title: string | null }): Promise<ModerationScores>
}

export interface AutoDecision {
  /** A capture, or an avatar version (US-07.6); a capture when absent. */
  targetType?: 'photo' | 'avatar'
  targetId: string
  decision: ModerationOutcome
  /** Raw answer, null when the provider did not answer. */
  scores: Record<string, unknown> | null
  reason: string | null
}

/** Port: the decisions history (`moderation_decisions`). */
export interface ModerationDecisionsRepository {
  /** Records the automatic decision of a capture, one per capture: a replay replaces it (US-14.2, US-52.6). */
  recordAuto(decision: AutoDecision): Promise<void>
}
