import { ChangePasswordBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { requireContext, sessionIdOf } from '../../platform/auth-context'

// New password of the signed-in member (US-07.3): 401 without a session, 400 for a wrong old password or a refused
// new one, 429 after 5 wrong old passwords; every other session ends.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const body = await readValidatedBody(event, ChangePasswordBody.parse)
  const sessionId = (await sessionIdOf(event))!
  orThrow(await container.identity.changePassword({ ...body, userId: actor.id, sessionId }))
  return sendNoContent(event)
})
