import type { SettingRow, SettingsRepository } from '../../server/modules/settings'

export const inMemorySettingsRepository = (rows: SettingRow[] = []): SettingsRepository => ({
  all: async () => rows.map((row) => structuredClone(row)),
})
