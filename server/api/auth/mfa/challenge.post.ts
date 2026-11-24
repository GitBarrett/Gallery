import { MfaCodeBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { requireContext, sessionIdOf, startCookieSession } from '../../../platform/auth-context'

// TOTP or recovery code after a staff sign-in (US-55.2, US-55.5): 400 for a wrong or used code, 429 after 5
// failures. The cookie gets a new session id that has passed the TOTP.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { code } = await readValidatedBody(event, MfaCodeBody.parse)
  const { sessionId } = orThrow(
    await container.identity.challengeMfa({
      actor,
      code,
      sessionId: (await sessionIdOf(event))!,
      userAgent: getHeader(event, 'user-agent'),
    }),
  )
  await startCookieSession(event, sessionId)
  return sendNoContent(event)
})
