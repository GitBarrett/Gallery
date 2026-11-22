import { ForgotPasswordBody } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'

// Reset link request (US-04.1, US-04.4), open to visitors: 204 whether the account exists or the limit is reached.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, ForgotPasswordBody.parse)
  orThrow(await event.context.container.identity.forgotPassword({ ...body, ip: getHeader(event, 'cf-connecting-ip') }))
  return sendNoContent(event)
})
