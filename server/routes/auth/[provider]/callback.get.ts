import { OAuthCallbackQuery, OAuthProviderParams } from '../../../../shared/contracts/auth'
import { oauthFlow, oauthFlowOf, sessionIdOf, startCookieSession } from '../../../platform/auth-context'

// Return from the provider (US-02.1–5). The state is used once: it leaves the cookie whatever the outcome, so a
// replayed callback gets 400. Refusal or provider error: back to the sign-in with a message (US-02.5).
export default defineEventHandler(async (event) => {
  const { provider } = await getValidatedRouterParams(event, OAuthProviderParams.parse)
  const query = await getValidatedQuery(event, OAuthCallbackQuery.parse)
  const { state, verifier, locale, invite } = await oauthFlowOf(event)
  const result = await event.context.container.identity.oauthCallback({
    provider,
    state: query.state,
    code: query.code,
    expected: state && verifier ? { state, verifier } : undefined,
    userAgent: getHeader(event, 'user-agent'),
    previousSessionId: await sessionIdOf(event),
  })
  const flow = await oauthFlow(event)
  const home = locale === 'fr' ? '/fr' : ''
  if (!result.ok) {
    await flow.clear()
    if (result.error.kind === 'oauth_failed') return sendRedirect(event, `${home}/signin?oauth=failed`)
    // the only other refusal: a missing, different or used state (US-02.4); Nuxt's error page, not the API format
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' })
  }
  if (result.value.kind === 'pending') {
    await flow.update({ state: undefined, verifier: undefined, pending: result.value.pending, locale, invite })
    return sendRedirect(event, `${home}/oauth/complete`)
  }
  await flow.clear()
  await startCookieSession(event, result.value.sessionId)
  return sendRedirect(event, home || '/')
})
