import { describe, expect, it } from 'vitest'
import { aesGcmSecretBox } from './aes-gcm-secret-box'

const KEY = 'a test MFA encryption key of 32 characters or more'

describe('aesGcmSecretBox', () => {
  it('US-55.2 seals the TOTP secret with a fresh IV and opens it back', async () => {
    const box = aesGcmSecretBox(KEY)
    const sealed = await box.seal('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(sealed).not.toContain('GEZDGNBV')
    expect(await box.seal('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).not.toBe(sealed)
    expect(await box.open(sealed)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  it('US-55.2 refuses a value altered or sealed with another key', async () => {
    const sealed = await aesGcmSecretBox(KEY).seal('secret')
    await expect(aesGcmSecretBox(`${KEY}!`).open(sealed)).rejects.toThrow()
    await expect(aesGcmSecretBox(KEY).open(`${sealed.slice(0, -2)}AA`)).rejects.toThrow()
  })
})
