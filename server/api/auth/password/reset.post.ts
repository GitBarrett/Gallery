import { ResetPasswordBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { sessionIdOf, startCookieSession } from '../../../platform/auth-context'

// New password from a reset link (US-04.2–3), open to visitors: every session ends, then the owner is signed in.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, ResetPasswordBody.parse)
  const { sessionId } = orThrow(
    await event.context.container.identity.resetPassword({
      ...body,
      userAgent: getHeader(event, 'user-agent'),
      previousSessionId: await sessionIdOf(event),
    }),
  )
  await startCookieSession(event, sessionId)
  return sendNoContent(event)
})
