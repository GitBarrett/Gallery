import { SignupBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'

// Sign-up (US-01), open to visitors (08-securite.md annexe B). 204 for a new or a used email alike (US-01.2).
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, SignupBody.parse)
  orThrow(await event.context.container.identity.signup({ ...body, ip: getHeader(event, 'cf-connecting-ip') }))
  return sendNoContent(event)
})
