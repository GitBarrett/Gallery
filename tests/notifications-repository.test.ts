import { notificationsRepositoryContract } from './contracts/notifications-repository.contract'
import { inMemoryNotificationsRepository } from './fakes/in-memory-notifications-repository'

notificationsRepositoryContract('in memory', async () => ({
  repo: inMemoryNotificationsRepository().repo,
  userId: crypto.randomUUID(),
}))
