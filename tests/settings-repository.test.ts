import { settingsRepositoryContract } from './contracts/settings-repository.contract'
import { inMemorySettingsRepository } from './fakes/in-memory-settings-repository'

settingsRepositoryContract('in memory', async (rows) => inMemorySettingsRepository(rows))
