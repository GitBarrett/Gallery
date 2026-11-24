import { catalogRepositoryContract } from './contracts/catalog-repository.contract'
import { inMemoryCatalogRepository } from './fakes/in-memory-catalog-repository'

catalogRepositoryContract('in-memory fake', (tags, check) => check(inMemoryCatalogRepository({ tags })))
