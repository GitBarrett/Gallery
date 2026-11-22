import { describe, expect, it, vi } from 'vitest'
import { fakeHumanVerifier, turnstileVerifier, TURNSTILE_DUMMY_TOKEN } from './turnstile-verifier'

const replying = (status: number, body: unknown) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))

describe('turnstileVerifier', () => {
  it('sends the secret, the token and the IP to siteverify', async () => {
    const fetch = replying(200, { success: true })
    expect(await turnstileVerifier({ secret: 's3cret', fetch }).verify('tok', '203.0.113.7')).toBe(true)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(JSON.parse(init!.body as string)).toEqual({ secret: 's3cret', response: 'tok', remoteip: '203.0.113.7' })
  })

  it('US-01.6 refuses a token rejected by Turnstile', async () => {
    const verifier = turnstileVerifier({ secret: 's', fetch: replying(200, { success: false }) })
    expect(await verifier.verify('tok', undefined)).toBe(false)
  })

  it('throws when siteverify is unavailable', async () => {
    await expect(turnstileVerifier({ secret: 's', fetch: replying(503, {}) }).verify('t', undefined)).rejects.toThrow(
      /503/,
    )
  })

  it('the fake accepts only the dummy token of the test site keys', async () => {
    expect(await fakeHumanVerifier.verify(TURNSTILE_DUMMY_TOKEN, undefined)).toBe(true)
    expect(await fakeHumanVerifier.verify('anything', undefined)).toBe(false)
  })
})
