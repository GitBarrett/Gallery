import { describe, expect, it } from 'vitest'
import { MAX_CAPTURE_BYTES, validateCaptureFile } from './capture-file'

const file = { contentType: 'image/png', bytes: 5_000_000, width: 1920, height: 1080 }

describe('capture file rules', () => {
  it('US-10.1 accepts a JPEG, PNG or WebP up to 20 MB, 640 to 7680 px on the long side, up to 8K', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp'])
      expect(validateCaptureFile({ ...file, contentType })).toEqual({ ok: true, value: contentType })
    expect(validateCaptureFile({ ...file, bytes: MAX_CAPTURE_BYTES }).ok).toBe(true)
    expect(validateCaptureFile({ ...file, width: 640, height: 360 }).ok).toBe(true)
    expect(validateCaptureFile({ ...file, width: 7680, height: 4320 }).ok).toBe(true)
    expect(validateCaptureFile({ ...file, width: 1080, height: 1920 }).ok).toBe(true) // portrait
  })

  it('US-10.2 refuses another type, an empty or too large file, and dimensions out of range, with the reason', () => {
    for (const contentType of ['image/gif', 'image/svg+xml', 'image/heic', 'image/x-tga'])
      expect(validateCaptureFile({ ...file, contentType })).toEqual({ ok: false, error: 'type' })
    expect(validateCaptureFile({ ...file, bytes: 0 })).toEqual({ ok: false, error: 'empty' })
    expect(validateCaptureFile({ ...file, bytes: MAX_CAPTURE_BYTES + 1 })).toEqual({ ok: false, error: 'too_large' })
    for (const [width, height] of [
      [639, 400],
      [7681, 1000],
      [7680, 4321], // above 33.2 Mpx
      [1920, 0],
    ])
      expect(validateCaptureFile({ ...file, width: width!, height: height! })).toEqual({
        ok: false,
        error: 'dimensions',
      })
  })
})
