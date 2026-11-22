import { describe, expect, it } from 'vitest'
import type { SettingRow, SettingsRepository } from '../../server/modules/settings'

// Contract of the SettingsRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `make` stores the given rows (keys unique to the run) and returns the repository.
export function settingsRepositoryContract(name: string, make: (rows: SettingRow[]) => Promise<SettingsRepository>) {
  describe(`SettingsRepository contract: ${name}`, () => {
    it('returns every stored row with its JSON value unchanged', async () => {
      const run = crypto.randomUUID()
      const rows = [
        { key: `contract.${run}.flag`, value: false },
        { key: `contract.${run}.object`, value: { uncommon: 3, rare: 15 } },
      ]
      expect(await (await make(rows)).all()).toEqual(expect.arrayContaining(rows))
    })
  })
}
