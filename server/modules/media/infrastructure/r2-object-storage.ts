import type { ObjectStorage, StoredObject } from '../application/ports'

/** The R2 binding, reduced to what the adapter uses. */
export interface R2Bucket {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get(
    key: string,
    options?: { range: { offset: number; length: number } },
  ): Promise<{ body: ReadableStream<Uint8Array> } | null>
  put(
    key: string,
    value: ReadableStream<Uint8Array> | Uint8Array,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>
  delete(key: string): Promise<void>
}

/** Workers global: a stream of known length, which R2 requires for a streamed put. Absent in Node runs. */
type FixedLength = new (bytes: number) => TransformStream<Uint8Array, Uint8Array>
const FixedLengthStream = (globalThis as { FixedLengthStream?: FixedLength }).FixedLengthStream

/** S3 token limited to the bucket (03-architecture.md § Configuration et secrets): signs the presigned URLs. */
export interface S3Credentials {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, text: string) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', imported, encoder.encode(text))
}
// RFC 3986, as SigV4 wants it: encodeURIComponent leaves !'()* alone
const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/**
 * AWS Signature V4 in the query string (presigned URL), payload unsigned. `headers` are signed: the request must
 * send them with these exact values (`host` is added).
 */
export async function presignUrl(options: {
  method: string
  host: string
  path: string
  headers: Record<string, string>
  /** More signed query parameters (`response-content-disposition`…). */
  query?: Record<string, string>
  region: string
  service: string
  date: Date
  expiresInSeconds: number
  accessKeyId: string
  secretAccessKey: string
}): Promise<string> {
  const amzDate = options.date.toISOString().replace(/[-:]|\.\d{3}/g, '') // 20130524T000000Z
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${options.region}/${options.service}/aws4_request`
  const headers = Object.entries({ ...options.headers, host: options.host })
    .map(([name, value]) => [name.toLowerCase(), value.trim()] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const signedHeaders = headers.map(([name]) => name).join(';')
  const query = Object.entries({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${options.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(options.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
    ...options.query,
  })
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .sort()
    .join('&')
  const canonical = [
    options.method,
    options.path,
    query,
    headers.map(([name, value]) => `${name}:${value}\n`).join(''),
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n')
  let key: ArrayBuffer | Uint8Array<ArrayBuffer> = encoder.encode(`AWS4${options.secretAccessKey}`)
  for (const part of [day, options.region, options.service, 'aws4_request']) key = await hmac(key, part)
  return `https://${options.host}${options.path}?${query}&X-Amz-Signature=${hex(await hmac(key, toSign))}`
}

/**
 * Private bucket (ADR-004): reads and deletes through the binding, browser uploads through a presigned PUT in path
 * style on `{account}.r2.cloudflarestorage.com` (CORS of infra/r2-cors.*.json, `connect-src` of the CSP). `prefix`:
 * the preview's folder in the shared bucket (ADR-013). Without `credentials`, only presigning fails (Q42).
 */
export function r2ObjectStorage(deps: {
  bucket: R2Bucket
  prefix: string
  credentials?: S3Credentials
  now: () => Date
}): ObjectStorage {
  const { bucket, prefix, credentials } = deps
  const presign = (
    method: 'GET' | 'PUT',
    key: string,
    signed: { headers?: Record<string, string>; query?: Record<string, string>; expiresInSeconds: number },
  ) => {
    if (!credentials) throw new Error('R2_ACCESS_KEY_ID is not configured')
    return presignUrl({
      method,
      host: `${credentials.accountId}.r2.cloudflarestorage.com`,
      path: `/${encode(credentials.bucket)}/${`${prefix}${key}`.split('/').map(encode).join('/')}`,
      headers: signed.headers ?? {},
      query: signed.query,
      region: 'auto',
      service: 's3',
      date: deps.now(),
      expiresInSeconds: signed.expiresInSeconds,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    })
  }
  return {
    presignPut: (key, file) =>
      presign('PUT', key, {
        headers: { 'content-length': String(file.bytes), 'content-type': file.contentType },
        expiresInSeconds: file.expiresInSeconds,
      }),
    // The download is a navigation, not a fetch: no CORS nor `connect-src` (03 § Pipeline image 7)
    presignGet: (key, file) =>
      presign('GET', key, {
        query: {
          'response-content-disposition': `attachment; filename="${file.filename}"`,
          'response-content-type': file.contentType,
        },
        expiresInSeconds: file.expiresInSeconds,
      }),
    async head(key): Promise<StoredObject | null> {
      const object = await bucket.head(`${prefix}${key}`)
      return object && { bytes: object.size, contentType: object.httpMetadata?.contentType }
    },
    async read(key, length) {
      const object = await bucket.get(`${prefix}${key}`, length ? { range: { offset: 0, length } } : undefined)
      return object?.body ?? null
    },
    async put(key, body, { bytes, contentType }) {
      const options = { httpMetadata: { contentType } }
      if (body instanceof Uint8Array || !FixedLengthStream)
        return void (await bucket.put(`${prefix}${key}`, body, options))
      const fixed = new FixedLengthStream(bytes)
      // Both awaited: an error of the source fails the put instead of being lost
      await Promise.all([bucket.put(`${prefix}${key}`, fixed.readable, options), body.pipeTo(fixed.writable)])
    },
    delete: (key) => bucket.delete(`${prefix}${key}`),
  }
}

/**
 * Bucket in memory for the Node test server, local runs without the R2 binding (fake providers only) and the
 * processing tests: the browser cannot PUT there, so `complete` answers 422 `missing` unless a test puts the object.
 */
export function memoryBucket(): R2Bucket & { objects: Map<string, { data: Uint8Array; contentType: string }> } {
  const objects = new Map<string, { data: Uint8Array; contentType: string }>()
  return {
    objects,
    async head(key) {
      const object = objects.get(key)
      return object ? { size: object.data.length, httpMetadata: { contentType: object.contentType } } : null
    },
    async get(key, options) {
      const object = objects.get(key)
      if (!object) return null
      const { offset, length } = options?.range ?? { offset: 0, length: object.data.length }
      return { body: new Blob([object.data.slice(offset, offset + length)]).stream() }
    },
    async put(key, value, { httpMetadata }) {
      const data = value instanceof Uint8Array ? value : new Uint8Array(await new Response(value).arrayBuffer())
      objects.set(key, { data, contentType: httpMetadata.contentType })
    },
    async delete(key) {
      objects.delete(key)
    },
  }
}
