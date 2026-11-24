import { describe, expect, it } from 'vitest'
import { objectStorageContract } from '../../../../tests/contracts/object-storage.contract'
import { memoryBucket, presignUrl, r2ObjectStorage } from './r2-object-storage'

const credentials = { accountId: 'acc0', bucket: 'ls-preview', accessKeyId: 'key-id', secretAccessKey: 'secret' }
const now = () => new Date('2026-11-24T10:00:00.000Z')

// The binding replaced by a map, under the prefix of preview 7
objectStorageContract('R2 (binding in memory)', () => {
  const bucket = memoryBucket()
  return {
    storage: r2ObjectStorage({ bucket, prefix: 'pr-7/', credentials, now }),
    put: (key, { bytes, contentType }) =>
      bucket.objects.set(`pr-7/${key}`, { data: new Uint8Array(bytes), contentType }),
  }
})

describe('R2 presigned URLs', () => {
  // Example of the AWS documentation, "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)"
  it('US-10.6 signs as AWS Signature V4 does', async () => {
    const url = await presignUrl({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      headers: {},
      region: 'us-east-1',
      service: 's3',
      date: new Date('2013-05-24T00:00:00Z'),
      expiresInSeconds: 86_400,
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    })
    expect(new URL(url).searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    )
  })

  it('US-10.6 puts in the private bucket, path style, under the preview prefix, signed on size and type', async () => {
    const storage = r2ObjectStorage({ bucket: memoryBucket(), prefix: 'pr-7/', credentials, now })
    const url = new URL(
      await storage.presignPut('incoming/0193', { contentType: 'image/jpeg', bytes: 99, expiresInSeconds: 600 }),
    )
    expect(`${url.origin}${url.pathname}`).toBe('https://acc0.r2.cloudflarestorage.com/ls-preview/pr-7/incoming/0193')
    expect(url.searchParams.get('X-Amz-Credential')).toBe('key-id/20261124/auto/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261124T100000Z')
    const other = await storage.presignPut('incoming/0193', {
      contentType: 'image/jpeg',
      bytes: 100,
      expiresInSeconds: 600,
    })
    expect(new URL(other).searchParams.get('X-Amz-Signature')).not.toBe(url.searchParams.get('X-Amz-Signature'))
  })
})
