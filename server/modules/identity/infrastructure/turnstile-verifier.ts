import { z } from 'zod'
import type { HumanVerifier } from '../application/ports'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const answer = z.object({ success: z.boolean() })

/** Turnstile siteverify. An unavailable service throws (500): the form is refused rather than left unprotected. */
export const turnstileVerifier = ({ secret, fetch }: { secret: string; fetch: Fetch }): HumanVerifier => ({
  async verify(token, ip) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`Turnstile siteverify failed (status ${response.status})`)
    return answer.parse(await response.json()).success
  },
})

/** Dummy token produced by the Turnstile test site keys (local, previews, tests): the fake accepts only it. */
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
export const fakeHumanVerifier: HumanVerifier = { verify: async (token) => token === TURNSTILE_DUMMY_TOKEN }
