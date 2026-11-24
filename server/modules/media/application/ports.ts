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
  /** Does nothing for a missing key. */
  delete(key: string): Promise<void>
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
  uploadedAt: Date | null
}

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
}

/** Key where the browser puts the file (03 § Pipeline image 2): server-made, no extension, never served. */
export const incomingKey = (photoId: string) => `incoming/${photoId}`
