import { VerifyEmailBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'

// Email verification (US-01.4), open to visitors: the token of the link designates the account.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, VerifyEmailBody.parse)
  orThrow(await event.context.container.identity.verifyEmail(body))
  return sendNoContent(event)
})
