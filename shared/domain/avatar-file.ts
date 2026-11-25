import { isCaptureType, type CaptureFile, type CaptureFileProblem, type CaptureType } from './capture-file'
import { err, ok, type Result } from './result'

// Avatar (US-07.6, 08-securite.md § 6): JPEG, PNG or WebP of 2 MB at most, cropped square in the browser; the
// server checks the same rules on the declared file, then on the stored one (magic bytes, real dimensions).
export const MAX_AVATAR_BYTES = 2_000_000
export const MIN_AVATAR_SIDE = 128
export const MAX_AVATAR_SIDE = 2048
/** The widths written once (ADR-012), square WebP. */
export const AVATAR_SIZES = [64, 128, 256] as const

export function validateAvatarFile(file: CaptureFile): Result<CaptureType, CaptureFileProblem> {
  if (!isCaptureType(file.contentType)) return err('type')
  if (file.bytes <= 0) return err('empty')
  if (file.bytes > MAX_AVATAR_BYTES) return err('too_large')
  if (file.width !== file.height || file.width < MIN_AVATAR_SIDE || file.width > MAX_AVATAR_SIDE)
    return err('dimensions')
  return ok(file.contentType)
}
