import { MfaCodeBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { requireContext, sessionIdOf, startCookieSession } from '../../../platform/auth-context'

// First TOTP code of the setup (US-55.2): 400 for a wrong code, 403 once enabled, 429 after 5 failures. Returns the
// 10 recovery codes, shown once; the cookie gets a new session id that has passed the TOTP.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { code } = await readValidatedBody(event, MfaCodeBody.parse)
  const { sessionId, recoveryCodes } = orThrow(
    await container.identity.verifyMfa({
      actor,
      code,
      sessionId: (await sessionIdOf(event))!,
      userAgent: getHeader(event, 'user-agent'),
    }),
  )
  await startCookieSession(event, sessionId)
  return { recoveryCodes }
})
