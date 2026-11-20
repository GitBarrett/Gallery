// Prototype jetable T-00d (docs/06-plan-de-taches.md, Q5) : Argon2id ou scrypt sur Workers ?
// GET /?alg=<nom> -> calcule un hachage. Le temps se mesure côté client : Date.now() ne bouge pas pendant un calcul pur.
import { argon2id as argon2Wasm } from 'hash-wasm'
import { argon2id as argon2Noble } from '@noble/hashes/argon2.js'
import { scrypt as scryptNoble } from '@noble/hashes/scrypt.js'
import { scryptSync } from 'node:crypto'

interface Env {
  PROTO_TOKEN: string
}

const PASSWORD = 'correct horse battery staple'
// Paramètres OWASP (Password Storage Cheat Sheet) : Argon2id m=19 MiB t=2 p=1 ; scrypt N=2^15 r=8 p=3 (32 MiB)
const ARGON = { t: 2, m: 19456, p: 1 }
const SCRYPT = { N: 2 ** 15, r: 8, p: 3 }

const ALGS: Record<string, (salt: Uint8Array) => Promise<unknown> | unknown> = {
  noop: () => null,
  'argon2-wasm': (salt) =>
    argon2Wasm({ password: PASSWORD, salt, iterations: ARGON.t, memorySize: ARGON.m, parallelism: ARGON.p, hashLength: 32 }),
  'argon2-noble': (salt) => argon2Noble(PASSWORD, salt, { ...ARGON, dkLen: 32 }),
  'scrypt-node': (salt) => scryptSync(PASSWORD, salt, 32, { ...SCRYPT, maxmem: 64 * 1024 * 1024 }),
  'scrypt-noble': (salt) => scryptNoble(PASSWORD, salt, { ...SCRYPT, dkLen: 32 }),
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.PROTO_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PROTO_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const alg = ALGS[new URL(request.url).searchParams.get('alg') ?? '']
    if (!alg) return new Response('Unknown alg', { status: 404 })
    try {
      await alg(crypto.getRandomValues(new Uint8Array(16)))
      return new Response('ok')
    } catch (e) {
      return new Response(String(e), { status: 500 })
    }
  },
}
