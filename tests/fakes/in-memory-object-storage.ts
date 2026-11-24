import type { ObjectStorage, StoredObject } from '../../server/modules/media'

/**
 * In-memory ObjectStorage for use case tests (11-strategie-de-tests.md § 3): `objects` holds what the browser put;
 * the URL carries what a presigned URL is signed on, with a dummy signature.
 */
export function inMemoryObjectStorage() {
  const objects = new Map<string, StoredObject>()
  const storage: ObjectStorage = {
    async presignPut(key, { contentType, bytes, expiresInSeconds }) {
      const query = new URLSearchParams({
        'X-Amz-Expires': String(expiresInSeconds),
        'X-Amz-SignedHeaders': 'content-length;content-type;host',
        'X-Amz-Signature': '0'.repeat(64),
        type: contentType,
        bytes: String(bytes),
      })
      return `https://r2.test/${key}?${query}`
    },
    head: async (key) => objects.get(key) ?? null,
    async delete(key) {
      objects.delete(key)
    },
  }
  return { storage, objects }
}
