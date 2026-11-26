// settings module (03-architecture.md § Modules): site_settings read through a 60 s cache.
export {
  LAUNCH_SETTINGS,
  MAX_HERO_LUMINANCE,
  validateSetting,
  type SettingKey,
  type SiteSettings,
} from './domain/settings'
export { settingsReader, type SettingRow, type SettingsRepository } from './application/read-settings'
export { drizzleSettingsRepository } from './infrastructure/drizzle-settings-repository'
export { toPublicSettings } from './interface/public-settings'
