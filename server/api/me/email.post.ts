import { EmailChangeBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { requireContext } from '../../platform/auth-context'

// Email change of the signed-in member (US-07.2): 401 without a session, 400 for a wrong current password or the
// same address, 429 after 3 requests in an hour; 204 otherwise, an address of another account included.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const body = await readValidatedBody(event, EmailChangeBody.parse)
  orThrow(await container.identity.requestEmailChange({ ...body, userId: actor.id }))
  return sendNoContent(event)
})
