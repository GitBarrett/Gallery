import { catalogRepositoryContract } from './contracts/catalog-repository.contract'
import { inMemoryCatalogRepository } from './fakes/in-memory-catalog-repository'

catalogRepositoryContract('in-memory fake', (seed, check) => check(inMemoryCatalogRepository(seed)))
