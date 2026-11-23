import { describe, expect, it } from 'vitest'
import { argon2idHasher } from '../server/modules/identity'
import { phc, SEED_ACCOUNT } from './seed.mjs'

describe('local seed (T-04e)', () => {
  it('stores the test password in the format the application verifies', async () => {
    const stored = phc(SEED_ACCOUNT.password)
    expect(await argon2idHasher().verify(SEED_ACCOUNT.password, stored)).toEqual({ valid: true, needsRehash: false })
    expect((await argon2idHasher().verify('wrong password', stored)).valid).toBe(false)
  })
})
