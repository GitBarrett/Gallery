// Staff TOTP (08-securite.md § 3): RFC 6238 with the defaults every authenticator app reads (HMAC-SHA-1, 6 digits,
// 30 s), one step of clock drift either side; a step once accepted is refused after (replay). WebCrypto only.

const STEP_SECONDS = 30
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const ISSUER = 'Legendary Shots'

const base32 = (bytes: Uint8Array) => {
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  return (bits.match(/.{5}/g) ?? []).map((chunk) => ALPHABET[parseInt(chunk, 2)]).join('')
}

function unbase32(text: string): Uint8Array<ArrayBuffer> {
  const bits = [...text].map((c) => ALPHABET.indexOf(c).toString(2).padStart(5, '0')).join('')
  return new Uint8Array((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
}

/** 160 random bits in base32 (RFC 4226 § 4), 32 characters. */
export const newTotpSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)))

export const otpauthUri = (secret: string, username: string) =>
  `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(username)}?secret=${secret}` +
  `&issuer=${encodeURIComponent(ISSUER)}`

/** Code of the 30 s step `step` (RFC 4226 dynamic truncation). */
export async function totpAt(secret: string, step: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const counter = new DataView(new ArrayBuffer(8))
  counter.setBigUint64(0, BigInt(step))
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter.buffer))
  const offset = mac[19]! & 0xf
  const value = new DataView(mac.buffer).getUint32(offset) & 0x7fffffff
  return String(value % 1_000_000).padStart(6, '0')
}

/** Step of `code` within one step of `now`, null if none matches or if it is not after `lastStep`. */
export async function matchTotp(
  secret: string,
  code: string,
  now: Date,
  lastStep: number | null,
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  const current = Math.floor(now.getTime() / 1000 / STEP_SECONDS)
  for (const step of [current - 1, current, current + 1])
    if (step > (lastStep ?? -1) && (await totpAt(secret, step)) === code) return step
  return null
}

/** 10 single-use codes of 50 random bits, `xxxxx-xxxxx`; only their SHA-256 is stored (03-architecture.md). */
export const newRecoveryCodes = () =>
  Array.from({ length: 10 }, () =>
    base32(crypto.getRandomValues(new Uint8Array(10)))
      .slice(0, 10)
      .toLowerCase()
      .replace(/^(.{5})/, '$1-'),
  )

/** A recovery code as typed: case, spaces and dashes ignored. */
export const normalizeRecoveryCode = (typed: string) =>
  typed
    .toLowerCase()
    .replace(/[\s-]/g, '')
    .replace(/^(.{5})/, '$1-')
