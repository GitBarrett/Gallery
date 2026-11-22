import { identityRepositoryContract } from './contracts/identity-repository.contract'
import { inMemoryIdentityRepository } from './fakes/in-memory-identity-repository'

identityRepositoryContract('in-memory fake', async () => inMemoryIdentityRepository().repo)
