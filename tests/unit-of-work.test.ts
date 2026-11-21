import { inMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import { unitOfWorkContract } from './contracts/unit-of-work.contract'

unitOfWorkContract('in-memory fake', async ({ queueFails }) => inMemoryUnitOfWork({}, { queueFails }))
