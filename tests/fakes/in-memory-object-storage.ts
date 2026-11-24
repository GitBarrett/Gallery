import type { ObjectStorage, StoredObject } from '../../server/modules/media'

type Stored = StoredObject & { data?: Uint8Array }

/**
 * In-memory ObjectStorage for use case tests (11-strategie-de-tests.md § 3): `objects` holds what the browser put
 * (`data` when the content matters, zeros otherwise); the URL carries what a presigned URL is signed on, with a dummy
 * signature.
 */
export function inMemoryObjectStorage() {
  const objects = new Map<string, Stored>()
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
    async head(key) {
      const object = objects.get(key)
      return object ? { bytes: object.bytes, contentType: object.contentType } : null
    },
    async read(key, length) {
      const object = objects.get(key)
      if (!object) return null
      return new Blob([(object.data ?? new Uint8Array(object.bytes)).slice(0, length)]).stream()
    },
    async put(key, body, { bytes, contentType }) {
      const data = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer())
      if (data.length !== bytes) throw new Error(`length ${data.length} differs from the declared ${bytes}`)
      objects.set(key, { bytes, contentType, data })
    },
    async delete(key) {
      objects.delete(key)
    },
  }
  return { storage, objects }
}
