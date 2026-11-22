import { argon2id } from '@noble/hashes/argon2.js'
import type { PasswordHasher } from '../application/ports'

interface Params {
  m: number // memory in KiB
  t: number
  p: number
}

const ADR_015: Params = { m: 19_456, t: 2, p: 1 } // 19 MiB
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

// PHC strings use standard base64 without padding
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '')
const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

function equal(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0 // constant time: every byte is compared
}

/** Argon2id in pure JavaScript (ADR-015): WebAssembly cannot be compiled at runtime on Workers. */
export function argon2idHasher(params: Params = ADR_015): PasswordHasher {
  return {
    async hash(password) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const key = argon2id(password, salt, { ...params, dkLen: 32 })
      return `$argon2id$v=19$m=${params.m},t=${params.t},p=${params.p}$${encode(salt)}$${encode(key)}`
    },
    async verify(password, stored) {
      const match = PHC.exec(stored)
      if (!match) return { valid: false, needsRehash: false }
      const [m, t, p] = [Number(match[1]), Number(match[2]), Number(match[3])]
      const expected = decode(match[5]!)
      const key = argon2id(password, decode(match[4]!), { m, t, p, dkLen: expected.length })
      const valid = equal(key, expected)
      return { valid, needsRehash: valid && (m !== params.m || t !== params.t || p !== params.p) }
    },
  }
}
