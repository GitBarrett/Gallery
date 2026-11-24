import type { ObjectStorage, StoredObject } from '../application/ports'

/** The R2 binding, reduced to what the adapter uses. */
export interface R2Bucket {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  delete(key: string): Promise<void>
}

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
  return {
    async presignPut(key, file) {
      if (!credentials) throw new Error('R2_ACCESS_KEY_ID is not configured')
      return presignUrl({
        method: 'PUT',
        host: `${credentials.accountId}.r2.cloudflarestorage.com`,
        path: `/${encode(credentials.bucket)}/${`${prefix}${key}`.split('/').map(encode).join('/')}`,
        headers: { 'content-length': String(file.bytes), 'content-type': file.contentType },
        region: 'auto',
        service: 's3',
        date: deps.now(),
        expiresInSeconds: file.expiresInSeconds,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      })
    },
    async head(key): Promise<StoredObject | null> {
      const object = await bucket.head(`${prefix}${key}`)
      return object && { bytes: object.size, contentType: object.httpMetadata?.contentType }
    },
    delete: (key) => bucket.delete(`${prefix}${key}`),
  }
}

/**
 * Bucket in memory for the Node test server and local runs without the R2 binding (fake providers only): nothing
 * reaches it, since the browser cannot PUT there; `complete` then answers 422 `missing`.
 */
export function memoryBucket(): R2Bucket & { objects: Map<string, { size: number; contentType: string }> } {
  const objects = new Map<string, { size: number; contentType: string }>()
  return {
    objects,
    async head(key) {
      const object = objects.get(key)
      return object ? { size: object.size, httpMetadata: { contentType: object.contentType } } : null
    },
    async delete(key) {
      objects.delete(key)
    },
  }
}
