import type { Result } from '../../../../shared/domain/result'

/** Validity of a verification link (US-01.1). */
export const VERIFY_TTL_MS = 24 * 3600_000

/** Error of an identity use case, mapped to HTTP by the interface layer. */
export type IdentityError =
  | { kind: 'invalid'; field: string; reason: string }
  | { kind: 'taken'; field: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'invite_required' }
  | { kind: 'not_found' }
  | { kind: 'invalid_credentials' }
export type IdentityResult = Result<void, IdentityError>

export const invalid = (field: string, reason: string): IdentityError => ({ kind: 'invalid', field, reason })

/** Link token: 256 random bits, base64url (08-securite.md § 3). Only its hash is stored. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
