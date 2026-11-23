import { MeUpdateBody, type MeResponse } from '../../shared/contracts/auth'
import { orThrow } from '../modules/identity'
import { requireContext } from '../platform/auth-context'

// Username change of the signed-in member (US-05.1, US-05.4; 08-securite.md annexe B, row "Compte"): 401 without a
// session, 429 within 30 days of the last change, 409 when taken.
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const { container, actor } = await requireContext(event)
  const { username } = await readValidatedBody(event, MeUpdateBody.parse)
  orThrow(await container.identity.changeUsername({ userId: actor.id, username }))
  return { id: actor.id, username, role: actor.role, emailVerified: actor.emailVerified }
})
