import { describe, expect, it } from 'vitest'
import type { ObjectStorage } from '../../server/modules/media'

// Contract of the ObjectStorage port (11-strategie-de-tests.md § 4). `make` returns the storage and `put`, standing
// for the browser's PUT through the presigned URL. The real bucket is exercised by tests/e2e/upload.spec.ts.
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

    it('US-10.7 deletes an object, and a missing one without failing', async () => {
      const { storage, put } = make()
      put('incoming/c', { bytes: 1, contentType: 'image/png' })
      await storage.delete('incoming/c')
      await storage.delete('incoming/c')
      expect(await storage.head('incoming/c')).toBeNull()
    })
  })
}
