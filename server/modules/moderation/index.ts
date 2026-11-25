// moderation module (03-architecture.md § Modules): automatic moderation (T-24); reports, queue, decisions and
// sanctions arrive with their tasks.
export { decide, type ModerationOutcome, type ModerationThresholds } from './domain/decision'
export type {
  AutoDecision,
  ModerationDecisionsRepository,
  ModerationProvider,
  ModerationScores,
} from './application/ports'
export { moderateCapture, PROVIDER_ATTEMPTS } from './application/moderate-capture'
export { drizzleModerationDecisions } from './infrastructure/drizzle-moderation-decisions'
export { fakeModerationProvider } from './infrastructure/fake-moderation-provider'
export { sightengineProvider } from './infrastructure/sightengine-provider'
