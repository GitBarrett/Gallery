import { SessionParams } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { requireContext } from '../../../platform/auth-context'

// Revokes one of the member's sessions (US-03.8); another member's or an unknown one: 404.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, SessionParams.parse)
  orThrow(await container.identity.revokeSession({ userId: actor.id, id }))
  return sendNoContent(event)
})
