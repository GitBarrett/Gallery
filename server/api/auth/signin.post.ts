import { SigninBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { oauthFlow, oauthFlowOf, sessionIdOf, startCookieSession } from '../../platform/auth-context'

// Password sign-in (US-03.1–3), open to visitors (08-securite.md annexe B). One 401 for any wrong credentials;
// Turnstile after 5 failures, 429 once the account is blocked. Links the pending OAuth identity of the same email (US-02.3).
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, SigninBody.parse)
  const { pending } = await oauthFlowOf(event)
  const { sessionId } = orThrow(
    await event.context.container.identity.signin({
      ...body,
      ip: getHeader(event, 'cf-connecting-ip'),
      userAgent: getHeader(event, 'user-agent'),
      previousSessionId: await sessionIdOf(event),
      oauthLink: pending,
    }),
  )
  await startCookieSession(event, sessionId)
  if (pending) await (await oauthFlow(event)).clear()
  return sendNoContent(event)
})
