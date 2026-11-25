import type { CaptureType } from '../../../../shared/domain/capture-file'

/** What the bucket holds under a key (R2 `head`). */
export interface StoredObject {
  bytes: number
  contentType: string | undefined
}

/**
 * Port: the private bucket (ADR-004). Keys are relative: the adapter adds the preview prefix (ADR-013). The
 * browser writes through a presigned URL, never through the Worker.
 */
export interface ObjectStorage {
  /** URL accepting one PUT of exactly `bytes` bytes of `contentType`, for `expiresInSeconds`. */
  presignPut(key: string, file: { contentType: CaptureType; bytes: number; expiresInSeconds: number }): Promise<string>
  head(key: string): Promise<StoredObject | null>
  /** The object as a stream, or its first `length` bytes; null for a missing key. */
  read(key: string, length?: number): Promise<ReadableStream<Uint8Array> | null>
  /** Writes the object; a stream must give exactly `bytes` bytes (R2 wants the length of a stream). */
  put(
    key: string,
    body: ReadableStream<Uint8Array> | Uint8Array,
    object: { bytes: number; contentType: string },
  ): Promise<void>
  /** Does nothing for a missing key. */
  delete(key: string): Promise<void>
}

/** What the Images binding reads in a file (ADR-011). */
export interface ImageInfo {
  format: string
  width: number
  height: number
}

export type VariantFormat = 'image/webp' | 'image/jpeg' | 'image/png'

/**
 * Port: the Images binding, called by the processing only (ADR-012: never on display). `render` is one billed
 * transformation: the image scaled down to `width` at most, keeping its ratio. Both throw when the service fails or
 * cannot decode the file.
 */
export interface ImageService {
  info(image: ReadableStream<Uint8Array>): Promise<ImageInfo>
  render(
    image: ReadableStream<Uint8Array>,
    output: { width: number; format: VariantFormat; quality?: number },
  ): Promise<Uint8Array<ArrayBuffer>>
}

export interface NewUpload {
  id: string
  userId: string
  mime: CaptureType
  bytes: number
  width: number
  height: number
}

export interface Upload {
  id: string
  userId: string
  mime: string
  bytes: number
  status: string
  uploadedAt: Date | null
  title: string | null
}

/** What the processing measured on the cleaned original. */
export interface Processed {
  bytes: number
  width: number
  height: number
  lumaBl: number
  lumaTr: number
  /** Max score of the automatic moderation, null when the provider did not answer (US-50.4). */
  moderationScore: number | null
  publishedAt: Date | null
}

/** End of the processing: the decision of the automatic moderation (US-50). */
export type ProcessedStatus = 'published' | 'pending_review' | 'rejected'

/**
 * Port: the automatic moderation of a processed capture (moderation module, wired by the composition root), given its
 * 1200 px JPEG; it records its decision and never throws for a provider down (US-50.4).
 */
export type ModerationGateway = (capture: {
  photoId: string
  title: string | null
  image: Uint8Array
}) => Promise<{ outcome: ProcessedStatus; score: number | null }>

/** Port: the captures of the media module. */
export interface MediaRepository {
  createUpload(upload: NewUpload): Promise<void>
  /** Uploads of the member requested since `since` and not completed. */
  countIncomplete(userId: string, since: Date): Promise<number>
  findUpload(id: string): Promise<Upload | null>
  /** Completes a capture still incomplete with an existing game version; false if it already was (double click). */
  complete(id: string, fields: { title: string; gameVersion: string; at: Date }): Promise<boolean>
  /** Uploads requested before `before` and never completed, `limit` at most. */
  incompleteBefore(before: Date, limit: number): Promise<string[]>
  deleteIncomplete(id: string): Promise<void>
  /** A capture still `processing` goes to `status` with its measures; false if it no longer was (replay). */
  finishProcessing(id: string, status: ProcessedStatus, processed: Processed): Promise<boolean>
  /** A capture still `processing` goes to `failed`; false if it no longer was. */
  failProcessing(id: string): Promise<boolean>
  /** Titles of the captures among `ids` that still exist, by id (null: not completed yet). */
  titles(ids: string[]): Promise<Map<string, string | null>>
  /** Completed captures of `userId`, latest first, `limit` at most, after the id `before` when given (UUID v7: by time). */
  listOwn(userId: string, page: { before?: string; limit: number }): Promise<OwnCapture[]>
}

/** Key where the browser puts the file (03 § Pipeline image 2): server-made, no extension, never served. */
export const incomingKey = (photoId: string) => `incoming/${photoId}`
/** The cleaned original (03 § Pipeline image 5), never served publicly. */
export const originalKey = (photoId: string) => `originals/${photoId}`
/** Display variants (ADR-012): `{400,800,1200,2400}.webp` and `1200.jpg`. */
export const variantKey = (photoId: string, name: string) => `variants/${photoId}/${name}`

/** Port: purge by URL of the edge cache (Cloudflare API Cache, 03 § Pipeline image 6). */
export interface CachePurger {
  purge(urls: string[]): Promise<void>
}

/** A capture of « My captures » (US-14.4): any status once the upload is completed. */
export interface OwnCapture {
  id: string
  title: string | null
  status: string
  width: number
  height: number
  uploadedAt: Date
}
