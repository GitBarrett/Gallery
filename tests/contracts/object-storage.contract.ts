import { describe, expect, it } from 'vitest'
import type { ObjectStorage } from '../../server/modules/media'

// Contract of the ObjectStorage port (11-strategie-de-tests.md § 4). `make` returns the storage and `put`, standing
// for the browser's PUT through the presigned URL. The real bucket is exercised by tests/e2e/upload.spec.ts.
const bytes = async (stream: ReadableStream<Uint8Array> | null) =>
  new Uint8Array(await new Response(stream).arrayBuffer())

export function objectStorageContract(
  name: string,
  make: () => { storage: ObjectStorage; put: (key: string, object: { bytes: number; contentType: string }) => void },
) {
  describe(`ObjectStorage contract: ${name}`, () => {
    it('US-10.6 presigns a PUT valid 10 minutes, signed on the declared size and type', async () => {
      const { storage } = make()
      const url = new URL(
        await storage.presignPut('incoming/a', { contentType: 'image/png', bytes: 1234, expiresInSeconds: 600 }),
      )
      expect(url.protocol).toBe('https:')
      expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    })

    it('US-10.6 tells the size and type of what was put, null for a missing key', async () => {
      const { storage, put } = make()
      expect(await storage.head('incoming/b')).toBeNull()
      put('incoming/b', { bytes: 42, contentType: 'image/webp' })
      expect(await storage.head('incoming/b')).toEqual({ bytes: 42, contentType: 'image/webp' })
    })

    it('US-14.1 reads an object whole or its first bytes, null for a missing key', async () => {
      const { storage } = make()
      const data = new Uint8Array([1, 2, 3, 4, 5])
      await storage.put('originals/d', data, { bytes: 5, contentType: 'image/png' })
      expect(await bytes(await storage.read('originals/d'))).toEqual(data)
      expect(await bytes(await storage.read('originals/d', 2))).toEqual(new Uint8Array([1, 2]))
      expect(await storage.read('originals/none')).toBeNull()
    })

    it('US-14.1 writes a stream of the given length, with its type, and overwrites the same key', async () => {
      const { storage } = make()
      const stream = () => new Blob([new Uint8Array([9, 8, 7])]).stream()
      await storage.put('variants/e/1200.jpg', stream(), { bytes: 3, contentType: 'image/jpeg' })
      await storage.put('variants/e/1200.jpg', stream(), { bytes: 3, contentType: 'image/jpeg' })
      expect(await storage.head('variants/e/1200.jpg')).toEqual({ bytes: 3, contentType: 'image/jpeg' })
      expect(await bytes(await storage.read('variants/e/1200.jpg'))).toEqual(new Uint8Array([9, 8, 7]))
    })

    it('US-10.7 deletes an object, and a missing one without failing', async () => {
      const { storage, put } = make()
      put('incoming/c', { bytes: 1, contentType: 'image/png' })
      await storage.delete('incoming/c')
      await storage.delete('incoming/c')
      expect(await storage.head('incoming/c')).toBeNull()
    })
  })
}
