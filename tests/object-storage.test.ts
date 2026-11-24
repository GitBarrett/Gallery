import { objectStorageContract } from './contracts/object-storage.contract'
import { inMemoryObjectStorage } from './fakes/in-memory-object-storage'

objectStorageContract('in-memory fake', () => {
  const { storage, objects } = inMemoryObjectStorage()
  return { storage, put: (key, object) => objects.set(key, object) }
})
