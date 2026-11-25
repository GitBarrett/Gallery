import { describe, expect, it } from 'vitest'
import { validateAvatarFile } from './avatar-file'

const file = { contentType: 'image/webp', bytes: 150_000, width: 512, height: 512 }

describe('validateAvatarFile', () => {
  it('US-07.6 accepts a square JPEG, PNG or WebP of 2 MB at most', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp'])
      expect(validateAvatarFile({ ...file, contentType })).toEqual({ ok: true, value: contentType })
    expect(validateAvatarFile({ ...file, bytes: 2_000_000 }).ok).toBe(true)
    expect(validateAvatarFile({ ...file, width: 128, height: 128 }).ok).toBe(true)
  })

  it('US-07.6 refuses another type, an empty or heavier file, a side not square or out of 128–2048 px', () => {
    expect(validateAvatarFile({ ...file, contentType: 'image/gif' })).toEqual({ ok: false, error: 'type' })
    expect(validateAvatarFile({ ...file, bytes: 0 })).toEqual({ ok: false, error: 'empty' })
    expect(validateAvatarFile({ ...file, bytes: 2_000_001 })).toEqual({ ok: false, error: 'too_large' })
    for (const [width, height] of <[number, number][]>[
      [512, 511],
      [127, 127],
      [2049, 2049],
    ])
      expect(validateAvatarFile({ ...file, width, height })).toEqual({ ok: false, error: 'dimensions' })
  })
})
