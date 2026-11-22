import type { Clock } from '../../../platform/clock'
import type { Logger } from '../../../platform/logger'
import { isSettingKey, LAUNCH_SETTINGS, validateSetting, type SiteSettings } from '../domain/settings'

export interface SettingRow {
  key: string
  value: unknown
}

/** Port: every row of site_settings. */
export interface SettingsRepository {
  all(): Promise<SettingRow[]>
}

const TTL_MS = 60_000 // US-56.1: an admin change applies within 60 s

/**
 * Settings read through a 60 s cache held by the caller (one per Worker isolate): each isolate reads the table
 * at most once a minute. A missing or invalid row falls back to its launch value.
 */
export function settingsReader({ repository, clock }: { repository: SettingsRepository; clock: Clock }) {
  let cached: { settings: SiteSettings; expiresAt: number } | undefined
  return async (logger: Logger): Promise<SiteSettings> => {
    const now = clock.now().getTime()
    if (cached && now < cached.expiresAt) return cached.settings
    const settings: Record<string, unknown> = { ...LAUNCH_SETTINGS }
    for (const { key, value } of await repository.all()) {
      if (!isSettingKey(key)) continue // keys of later tasks (legal: T-70)
      const valid = validateSetting(key, value)
      if (valid.ok) settings[key] = value
      else logger.warn('invalid site setting ignored', { key, problem: valid.error })
    }
    cached = { settings: settings as unknown as SiteSettings, expiresAt: now + TTL_MS }
    return cached.settings
  }
}
