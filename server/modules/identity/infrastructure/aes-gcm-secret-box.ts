import type { SecretBox } from '../application/ports'

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const b64 = (data: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(data)))

/**
 * TOTP secrets sealed with AES-256-GCM (08-securite.md § 3): the key is the SHA-256 of `MFA_ENCRYPTION_KEY`, each
 * value gets a random 96-bit IV and is stored as `v1.<iv>.<ciphertext and tag>` in base64.
 */
export function aesGcmSecretBox(secret: string): SecretBox {
  const key = crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(secret))
    .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']))
  return {
    async seal(plain) {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key, new TextEncoder().encode(plain))
      return `v1.${b64(iv)}.${b64(data)}`
    },
    async open(sealed) {
      const [version, iv, data] = sealed.split('.')
      if (version !== 'v1' || !iv || !data) throw new Error('Unknown sealed value')
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key, bytes(data))
      return new TextDecoder().decode(plain)
    },
  }
}
