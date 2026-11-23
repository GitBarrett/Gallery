import { VerifyEmailBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'

// Link of the email change (US-07.2), open to visitors: the token designates the account and its new address, once.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, VerifyEmailBody.parse)
  orThrow(await event.context.container.identity.confirmEmailChange(body))
  return sendNoContent(event)
})
