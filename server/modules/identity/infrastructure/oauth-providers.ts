import { z } from 'zod'
import type { OAuthProvider, OAuthProviderName } from '../application/ports'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const Token = z.object({ access_token: z.string().min(1) })
const UserInfo = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254).optional(),
  email_verified: z.boolean().optional(),
})

/**
 * Google, OpenID Connect authorization code flow with PKCE S256, confidential client (08-securite.md § 3). The
 * identity comes from the userinfo endpoint over TLS with the access token, so the ID token is not checked.
 */
export const googleOAuthProvider = ({
  clientId,
  clientSecret,
  fetch,
}: {
  clientId: string
  clientSecret: string
  fetch: Fetch
}): OAuthProvider => ({
  authorizationUrl({ state, codeChallenge, redirectUri }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },
  async identity({ code, codeVerifier, redirectUri }) {
    const token = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!token.ok) throw new Error(`Google token endpoint answered ${token.status}`)
    const { access_token } = Token.parse(await token.json())
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(5_000),
    })
    if (!info.ok) throw new Error(`Google userinfo answered ${info.status}`)
    const user = UserInfo.parse(await info.json())
    return { subject: user.sub, email: user.email_verified === true ? (user.email ?? null) : null }
  },
})

/**
 * Provider of local runs and previews. Its consent page, `<consentUrl>/<provider>`, is a test route of the previews
 * whose address comes from NUXT_FAKE_OAUTH_CONSENT_URL, unknown to the production build. It sends back the email
 * typed as the code (a code without "@": no email; "invalid": refused by the exchange).
 */
export const fakeOAuthProvider = (consentUrl: string, provider: OAuthProviderName): OAuthProvider => ({
  authorizationUrl: ({ state, codeChallenge }) =>
    `${consentUrl}/${provider}?${new URLSearchParams({ state, code_challenge: codeChallenge })}`,
  async identity({ code }) {
    if (code === 'invalid') throw new Error('invalid_grant')
    return { subject: `fake-${code}`, email: code.includes('@') ? code : null }
  },
})
