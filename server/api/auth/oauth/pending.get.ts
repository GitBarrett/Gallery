import type { OAuthPendingResponse } from '../../../../shared/contracts/auth'
import { oauthFlowOf } from '../../../platform/auth-context'
import { AppError } from '../../../platform/http-errors'

// Identity waiting for its account (US-02.1) or for the sign-in that links it (US-02.3): only the browser of the
// flow holds its sealed cookie. 404 once used or expired.
export default defineEventHandler(async (event): Promise<OAuthPendingResponse> => {
  const { pending } = await oauthFlowOf(event)
  if (!pending) throw new AppError('NOT_FOUND', 'No OAuth sign-in in progress')
  return { provider: pending.provider, email: pending.email, emailTaken: pending.emailTaken }
})
