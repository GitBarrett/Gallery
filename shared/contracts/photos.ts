import { z } from './zod'

/**
 * POST /api/photos/upload-url: the file the browser is about to send (US-10.1), checked again by the server against
 * shared/domain/capture-file.ts (US-10.2). The presigned URL is signed on `contentType` and `bytes`.
 */
export const UploadUrlBody = z.strictObject({
  contentType: z.string().max(100),
  bytes: z.int().min(0).max(1_000_000_000),
  width: z.int().min(0).max(100_000),
  height: z.int().min(0).max(100_000),
})
export type UploadUrlBody = z.infer<typeof UploadUrlBody>

/** PUT the file to `url` with the declared `Content-Type` before `expiresAt` (10 min), then call `complete`. */
export const UploadUrlResponse = z.strictObject({ photoId: z.uuid(), url: z.url(), expiresAt: z.iso.datetime() })
export type UploadUrlResponse = z.infer<typeof UploadUrlResponse>

/**
 * POST /api/photos/{id}/complete, once the PUT succeeded: title and game version of the capture (US-10.1). Accepts
 * an `Idempotency-Key` header; a second call answers the same without processing the capture twice.
 */
export const CompleteUploadBody = z.strictObject({
  title: z.string().trim().min(1).max(100),
  gameVersion: z.string().min(1).max(64), // slug of GET /api/game-versions
})
export type CompleteUploadBody = z.infer<typeof CompleteUploadBody>

export const CompleteUploadResponse = z.strictObject({ photoId: z.uuid(), status: z.literal('processing') })
export type CompleteUploadResponse = z.infer<typeof CompleteUploadResponse>

/** `{id}` of the /api/photos/{id}/… routes. */
export const PhotoParams = z.strictObject({ id: z.uuid() })

/** GET /api/me/photos (« My captures », US-14.4): `cursor` from the previous page. */
export const MyPhotosQuery = z.strictObject({ cursor: z.uuid().optional() })
export const MyPhotosResponse = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.uuid(),
      title: z.string().nullable(),
      status: z.enum(['processing', 'failed', 'pending_review', 'published', 'rejected', 'hidden']),
      width: z.int(),
      height: z.int(),
      uploadedAt: z.iso.datetime(),
    }),
  ),
  nextCursor: z.uuid().nullable(),
})
export type MyPhotosResponse = z.infer<typeof MyPhotosResponse>
