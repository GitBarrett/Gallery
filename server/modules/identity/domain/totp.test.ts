import { describe, expect, it } from 'vitest'
import { matchTotp, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUri, totpAt } from './totp'

// RFC 6238 appendix B, SHA-1: the ASCII secret "12345678901234567890" in base32
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // gitleaks:allow (public RFC 6238 test vector)
const at = (seconds: number) => new Date(seconds * 1000)

describe('TOTP (RFC 6238)', () => {
  it('US-55.2 gives the codes of the RFC test vectors (last 6 digits)', async () => {
    expect(await totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe('287082')
    expect(await totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804')
    expect(await totpAt(RFC_SECRET, Math.floor(20000000000 / 30))).toBe('353130')
  })

  it('US-55.2 accepts the code of the current step and of one step either side, and returns its step', async () => {
    const now = at(1111111109)
    const step = Math.floor(1111111109 / 30)
    for (const s of [step - 1, step, step + 1])
      expect(await matchTotp(RFC_SECRET, await totpAt(RFC_SECRET, s), now, null)).toBe(s)
    expect(await matchTotp(RFC_SECRET, await totpAt(RFC_SECRET, step + 2), now, null)).toBeNull()
    expect(await matchTotp(RFC_SECRET, '12345', now, null)).toBeNull()
  })

  it('US-55.2 refuses a code of a step already used (replay)', async () => {
    const now = at(1111111109)
    const step = Math.floor(1111111109 / 30)
    const code = await totpAt(RFC_SECRET, step)
    expect(await matchTotp(RFC_SECRET, code, now, step)).toBeNull()
    expect(await matchTotp(RFC_SECRET, await totpAt(RFC_SECRET, step + 1), now, step)).toBe(step + 1)
  })

  it('US-55.2 makes a 160-bit base32 secret and the otpauth URI of the authenticator apps', () => {
    const secret = newTotpSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(newTotpSecret()).not.toBe(secret)
    expect(otpauthUri(secret, 'Ash Barrett')).toBe(
      `otpauth://totp/Legendary%20Shots:Ash%20Barrett?secret=${secret}&issuer=Legendary%20Shots`,
    )
  })

  it('US-55.2 makes 10 distinct recovery codes, read without case or dashes', () => {
    const codes = newRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/)
    expect(normalizeRecoveryCode(` ${codes[0]!.toUpperCase().replace('-', '')} `)).toBe(codes[0])
  })
})
