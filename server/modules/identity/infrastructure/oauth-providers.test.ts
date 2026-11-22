import { describe, expect, it, vi } from 'vitest'
import { fakeOAuthProvider, googleOAuthProvider } from './oauth-providers'

const redirectUri = 'https://legendaryshots.gg/auth/google/callback'
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

function google(userinfo: unknown, tokenStatus = 200) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
    url.endsWith('/token') ? json(tokenStatus, { access_token: 'at', token_type: 'Bearer' }) : json(200, userinfo),
  )
  return { fetch, provider: googleOAuthProvider({ clientId: 'cid', clientSecret: 'csecret', fetch }) }
}

describe('googleOAuthProvider', () => {
  it('US-02.4 asks for the openid email scopes with the state and the S256 challenge', () => {
    const url = new URL(google({}).provider.authorizationUrl({ state: 'st', codeChallenge: 'ch', redirectUri }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    })
  })

  it('US-02.1 exchanges the code with the verifier and keeps a verified email', async () => {
    const { fetch, provider } = google({ sub: '1234', email: 'ash@gmail.com', email_verified: true })
    expect(await provider.identity({ code: 'c', codeVerifier: 'v', redirectUri })).toEqual({
      subject: '1234',
      email: 'ash@gmail.com',
    })
    const [tokenUrl, init] = fetch.mock.calls[0]!
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token')
    expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      code_verifier: 'v',
      redirect_uri: redirectUri,
      client_id: 'cid',
      client_secret: 'csecret',
    })
    expect(fetch.mock.calls[1]).toEqual([
      'https://openidconnect.googleapis.com/v1/userinfo',
      expect.objectContaining({ headers: { Authorization: 'Bearer at' } }),
    ])
  })

  it('ignores an email Google did not verify', async () => {
    const { provider } = google({ sub: '1234', email: 'ash@example.com', email_verified: false })
    expect(await provider.identity({ code: 'c', codeVerifier: 'v', redirectUri })).toEqual({
      subject: '1234',
      email: null,
    })
  })

  it('US-02.5 rejects a refused code or an answer out of contract', async () => {
    await expect(google({}, 400).provider.identity({ code: 'c', codeVerifier: 'v', redirectUri })).rejects.toThrow(
      '400',
    )
    await expect(
      google({ email: 'x' }).provider.identity({ code: 'c', codeVerifier: 'v', redirectUri }),
    ).rejects.toThrow()
  })
})

describe('fakeOAuthProvider', () => {
  it('sends to the test consent page and takes the typed email as the identity', async () => {
    const fake = fakeOAuthProvider('https://ls-pr-1.example.dev/__test/oauth', 'google')
    expect(fake.authorizationUrl({ state: 'st', codeChallenge: 'ch', redirectUri })).toBe(
      'https://ls-pr-1.example.dev/__test/oauth/google?state=st&code_challenge=ch',
    )
    expect(await fake.identity({ code: 'ash@example.com', codeVerifier: 'v', redirectUri })).toEqual({
      subject: 'fake-ash@example.com',
      email: 'ash@example.com',
    })
    expect(await fake.identity({ code: 'no-email', codeVerifier: 'v', redirectUri })).toEqual({
      subject: 'fake-no-email',
      email: null,
    })
    await expect(fake.identity({ code: 'invalid', codeVerifier: 'v', redirectUri })).rejects.toThrow()
  })
})
