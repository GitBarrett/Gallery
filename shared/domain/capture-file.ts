import { err, ok, type Result } from './result'

// File rules of a capture (US-10.1, 03-architecture.md § Pipeline image 1), checked by the upload form and again by
// the server (US-10.2). A TGA is converted to PNG in the browser first, so only these three types reach the server.

export const CAPTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type CaptureType = (typeof CAPTURE_TYPES)[number]
/** 20 MB, input limit of the Images binding (decimal: the smaller reading of "20 Mo"). */
export const MAX_CAPTURE_BYTES = 20_000_000
export const MIN_LONG_SIDE = 640
export const MAX_LONG_SIDE = 7680
/** 8K, 7680 × 4320. */
export const MAX_PIXELS = 7680 * 4320

export type CaptureFileProblem = 'type' | 'too_large' | 'empty' | 'dimensions'

export interface CaptureFile {
  contentType: string
  bytes: number
  width: number
  height: number
}

export const isCaptureType = (type: string): type is CaptureType => (CAPTURE_TYPES as readonly string[]).includes(type)

/** Why the file is refused, or ok. */
export function validateCaptureFile(file: CaptureFile): Result<CaptureType, CaptureFileProblem> {
  if (!isCaptureType(file.contentType)) return err('type')
  if (file.bytes <= 0) return err('empty')
  if (file.bytes > MAX_CAPTURE_BYTES) return err('too_large')
  const long = Math.max(file.width, file.height)
  const short = Math.min(file.width, file.height)
  if (short < 1 || long < MIN_LONG_SIDE || long > MAX_LONG_SIDE || file.width * file.height > MAX_PIXELS)
    return err('dimensions')
  return ok(file.contentType)
}
