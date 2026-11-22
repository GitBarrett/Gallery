import { z } from 'zod'
import type { HumanVerifier } from '../application/ports'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const answer = z.object({ success: z.boolean(), action: z.string().optional(), hostname: z.string().optional() })

/**
 * Turnstile siteverify. The token must be valid, made for this form (`action`) on this site (`hostname`): a token
 * solved on another site with the same widget is refused. An unavailable service throws (500): the form is
 * refused rather than left unprotected.
 */
export const turnstileVerifier = ({
  secret,
  hostname,
  fetch,
}: {
  secret: string
  hostname: string
  fetch: Fetch
}): HumanVerifier => ({
  async verify(token, ip, action) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`Turnstile siteverify failed (status ${response.status})`)
    const result = answer.parse(await response.json())
    return result.success && result.action === action && result.hostname === hostname
  },
})

/** Dummy token produced by the Turnstile test site keys (local, previews, tests): the fake accepts only it. */
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
export const fakeHumanVerifier: HumanVerifier = { verify: async (token) => token === TURNSTILE_DUMMY_TOKEN }
