import { OAuthCompleteBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { oauthFlow, oauthFlowOf, sessionIdOf, startCookieSession } from '../../../platform/auth-context'
import { AppError } from '../../../platform/http-errors'

// Username and Terms step of a first OAuth sign-in (US-02.1), open to the browser holding the pending identity:
// creates the account and signs in (204). 409 `email` for the email of an existing account (US-02.3).
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, OAuthCompleteBody.parse)
  const { pending, invite } = await oauthFlowOf(event)
  if (!pending) throw new AppError('NOT_FOUND', 'No OAuth sign-in in progress')
  const { sessionId } = orThrow(
    await event.context.container.identity.completeOAuthSignup({
      ...body,
      pending,
      inviteToken: invite,
      ip: getHeader(event, 'cf-connecting-ip'),
      userAgent: getHeader(event, 'user-agent'),
      previousSessionId: await sessionIdOf(event),
    }),
  )
  await (await oauthFlow(event)).clear()
  await startCookieSession(event, sessionId)
  return sendNoContent(event)
})
