import type { Logger } from '../../../platform/logger'
import type { BreachChecker } from '../application/ports'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * Pwned Passwords range API (k-anonymity): only the first 5 hex characters of the SHA-1 leave the Worker, and
 * padding hides the size of the answer. If HIBP is unavailable, the password is accepted (Q41): sign-up must not
 * depend on a third party.
 */
export const hibpBreachChecker = ({ fetch, logger }: { fetch: Fetch; logger: Logger }): BreachChecker => ({
  async isBreached(password) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password)))
    const sha1 = Array.from(digest, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) throw new Error(`HIBP status ${response.status}`)
      const suffix = sha1.slice(5)
      return (await response.text())
        .split('\n')
        .some((line) => line.startsWith(`${suffix}:`) && Number(line.slice(36)) > 0)
    } catch (error) {
      logger.warn('breach check unavailable, password accepted', { error })
      return false
    }
  },
})
