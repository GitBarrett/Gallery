import { OAuthProviderParams, OAuthStartQuery } from '../../../shared/contracts/auth'
import { oauthFlow } from '../../platform/auth-context'

// First leg of an OAuth sign-in (US-02), open to visitors: a fresh state and PKCE verifier sealed in a short
// cookie, then the provider. A navigation, not an API call: the Service Worker leaves /auth to the network.
export default defineEventHandler(async (event) => {
  const { provider } = await getValidatedRouterParams(event, OAuthProviderParams.parse)
  const { locale, invite } = await getValidatedQuery(event, OAuthStartQuery.parse)
  const { url, state, verifier } = await event.context.container.identity.startOAuth(provider)
  await (await oauthFlow(event)).update({ state, verifier, locale, invite, pending: undefined })
  return sendRedirect(event, url)
})
