import { WaitlistBody } from '../../shared/contracts/auth'
import { orThrow } from '../modules/identity'

// Waiting list of the beta (US-56.4), open to visitors (08-securite.md annexe B). 204 whether the email was
// already listed or not; 404 once features.inviteOnly is off.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, WaitlistBody.parse)
  orThrow(await event.context.container.identity.joinWaitlist({ ...body, ip: getHeader(event, 'cf-connecting-ip') }))
  return sendNoContent(event)
})
