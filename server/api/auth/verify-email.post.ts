import { VerifyEmailBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { sessionIdOf, startCookieSession } from '../../platform/auth-context'

// Email verification (US-01.4), open to visitors: the token of the link designates the account, and signs it in
// (US-01.1, Q44).
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, VerifyEmailBody.parse)
  const { sessionId } = orThrow(
    await event.context.container.identity.verifyEmail({
      ...body,
      userAgent: getHeader(event, 'user-agent'),
      previousSessionId: await sessionIdOf(event),
    }),
  )
  await startCookieSession(event, sessionId)
  return sendNoContent(event)
})
