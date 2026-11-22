import type { QualityThresholds } from '../../../../shared/domain/quality'
import { err, ok, type Result } from '../../../../shared/domain/result'

/** Rows of site_settings, one key each (03-architecture.md § Modèle de données). Edited by the admin in T-53b. */
export interface SiteSettings {
  'quality.thresholds': QualityThresholds
  /** Sightengine max score: from `review` → pending_review, from `reject` → rejected (02-specs § 6). */
  'moderation.scores': { review: number; reject: number }
  'moderation.reportsToHide': number
  /** Counters below this value are not shown (US-70.6). */
  'display.minVisibleCount': number
  /** Likes over 7 days for « Capture of the week », else its fallbacks (US-70.4). */
  'display.captureOfWeekMinLikes': number
  'home.hero': { photoId: string; luminance: number } | null
  'home.editorsPick': string | null
  'features.contests': boolean
  'features.follows': boolean
  'features.collections': boolean
  'features.leaderboard': boolean
  'features.ads': boolean
  'features.donations': boolean
  'features.readonly': boolean
  'features.inviteOnly': boolean
}
export type SettingKey = keyof SiteSettings
export type SettingProblem = 'unknown_key' | 'invalid_value' | 'thresholds_not_ascending' | 'hero_too_bright'

/** Values used while a key has no valid row: launch values of 06-plan-de-taches.md T-08. */
export const LAUNCH_SETTINGS: SiteSettings = {
  'quality.thresholds': { uncommon: 3, rare: 15, epic: 50, legendary: 150 },
  'moderation.scores': { review: 0.5, reject: 0.85 },
  'moderation.reportsToHide': 3,
  'display.minVisibleCount': 10,
  'display.captureOfWeekMinLikes': 10,
  'home.hero': null,
  'home.editorsPick': null,
  'features.contests': false,
  'features.follows': false,
  'features.collections': false,
  'features.leaderboard': false,
  'features.ads': false,
  'features.donations': false,
  'features.readonly': false,
  'features.inviteOnly': true, // until the public opening
}

export const MAX_HERO_LUMINANCE = 0.6 // 07-design.md § Contraste: white text stays readable

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1
const isScore = (v: unknown): v is number => typeof v === 'number' && v > 0 && v <= 1
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
/** An object with exactly these keys, each passing `check`. */
const hasExactly = (v: unknown, keys: string[], check: (field: unknown) => boolean): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => k in v && check((v as Record<string, unknown>)[k]))
const ascending = (values: number[]) => values.every((value, i) => i === 0 || value > values[i - 1]!)

type Check = (value: unknown) => SettingProblem | undefined
const shape =
  (valid: (v: unknown) => boolean): Check =>
  (v) =>
    valid(v) ? undefined : 'invalid_value'
const flag = shape((v) => typeof v === 'boolean')

const CHECKS: Record<SettingKey, Check> = {
  'quality.thresholds': (v) => {
    const tiers = ['uncommon', 'rare', 'epic', 'legendary']
    if (!hasExactly(v, tiers, isCount)) return 'invalid_value'
    return ascending(tiers.map((t) => v[t] as number)) ? undefined : 'thresholds_not_ascending'
  },
  'moderation.scores': (v) => {
    if (!hasExactly(v, ['review', 'reject'], isScore)) return 'invalid_value'
    return ascending([v.review as number, v.reject as number]) ? undefined : 'thresholds_not_ascending'
  },
  'moderation.reportsToHide': shape(isCount),
  'display.minVisibleCount': shape(isCount),
  'display.captureOfWeekMinLikes': shape(isCount),
  'home.hero': (v) => {
    if (v === null) return undefined
    if (!hasExactly(v, ['photoId', 'luminance'], () => true) || !isUuid(v.photoId)) return 'invalid_value'
    if (typeof v.luminance !== 'number' || v.luminance < 0) return 'invalid_value'
    return v.luminance > MAX_HERO_LUMINANCE ? 'hero_too_bright' : undefined
  },
  'home.editorsPick': shape((v) => v === null || isUuid(v)),
  'features.contests': flag,
  'features.follows': flag,
  'features.collections': flag,
  'features.leaderboard': flag,
  'features.ads': flag,
  'features.donations': flag,
  'features.readonly': flag,
  'features.inviteOnly': flag,
}

export const isSettingKey = (key: string): key is SettingKey => Object.hasOwn(CHECKS, key)

/** Checks a value before it is saved or used (US-56.2); the error is the reason shown to the admin. */
export function validateSetting(key: string, value: unknown): Result<unknown, SettingProblem> {
  if (!isSettingKey(key)) return err('unknown_key')
  const problem = CHECKS[key](value)
  return problem ? err(problem) : ok(value)
}
