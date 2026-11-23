import { OAuthProviderParams } from '../../../../shared/contracts/auth'
import { orThrow } from '../../../modules/identity'
import { requireContext } from '../../../platform/auth-context'

// Unlinks a Google or Battle.net account of the signed-in member (US-07.4): 401 without a session, 404 when not
// linked, 403 when no sign-in method would remain.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { provider } = await getValidatedRouterParams(event, OAuthProviderParams.parse)
  orThrow(await container.identity.unlinkOAuth({ userId: actor.id, provider }))
  return sendNoContent(event)
})
