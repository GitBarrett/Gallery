import { describe, expect, it } from 'vitest'
import { argon2idHasher } from './argon2id-hasher'

const hasher = argon2idHasher()

describe('argon2idHasher', () => {
  it('stores the ADR-015 parameters in the PHC format', async () => {
    expect(await hasher.hash('correct horse battery')).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    )
  })

  it('verifies a hash of the reference implementation (phc-winner-argon2 src/test.c)', async () => {
    const reference = '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc'
    expect(await hasher.verify('password', reference)).toEqual({ valid: true, needsRehash: true })
  })

  it('salts every hash', async () => {
    expect(await hasher.hash('correct horse battery')).not.toBe(await hasher.hash('correct horse battery'))
  })

  it('verifies the right password only', async () => {
    const stored = await hasher.hash('correct horse battery')
    expect(await hasher.verify('correct horse battery', stored)).toEqual({ valid: true, needsRehash: false })
    expect(await hasher.verify('correct horse batterY', stored)).toEqual({ valid: false, needsRehash: false })
  })

  it('verifies a hash made with older parameters and asks for a rehash', async () => {
    const stored = await argon2idHasher({ m: 64, t: 1, p: 1 }).hash('correct horse battery')
    expect(stored).toContain('$m=64,t=1,p=1$')
    expect(await hasher.verify('correct horse battery', stored)).toEqual({ valid: true, needsRehash: true })
  })

  it.each([
    '',
    'not a hash',
    '$argon2i$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA',
    '$argon2id$v=19$m=x,t=2,p=1$c2FsdA$aGFzaA',
  ])('refuses the malformed stored value %j', async (stored) => {
    expect(await hasher.verify('correct horse battery', stored)).toEqual({ valid: false, needsRehash: false })
  })
})
